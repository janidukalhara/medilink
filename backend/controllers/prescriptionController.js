const axios = require('axios');
const Prescription = require('../models/Prescription');
const Quotation = require('../models/Quotation');
const User = require('../models/User');
const Notification = require('../models/Notification');
const { uploadToCloudinary } = require('../utils/cloudinary');
const { sendEmail, prescriptionProcessedTemplate } = require('../utils/email');

// ─── Upload prescription ───────────────────────────────────────────────────────
exports.uploadPrescription = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const cloudResult = await uploadToCloudinary(req.file.buffer);

    const prescription = await Prescription.create({
      patient: req.user._id,
      imageUrl: cloudResult.secure_url,
      imagePublicId: cloudResult.public_id,
      status: 'processing',
      isUrgent: req.body.isUrgent === 'true',
      notes: req.body.notes,
    });

    res.status(201).json({ message: 'Uploaded. AI processing started.', prescription });

    // Fire-and-forget — never blocks the HTTP response
    _processOCR(prescription, cloudResult.secure_url, req.user, req.io);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ─── AI OCR pipeline with retry ───────────────────────────────────────────────
// Timeout is 5 min (300s) — BERT model download takes ~2 min on first call.
// Retries up to 2 times so that if attempt 1 times out while BERT loads,
// attempt 2 will succeed immediately from cache.
const AI_TIMEOUT_MS  = Number(process.env.AI_TIMEOUT_MS) || 60000;   // 5 min
const AI_MAX_RETRIES = 3;

async function _processOCR(prescription, imageUrl, user, io) {
  const aiUrl = process.env.AI_SERVICE_URL || 'http://localhost:8000';
  let lastError = null;

  for (let attempt = 1; attempt <= AI_MAX_RETRIES; attempt++) {
    try {
      console.log(`🤖 AI attempt ${attempt}/${AI_MAX_RETRIES} — prescription ${prescription._id}`);

      const { data: result } = await axios.post(
        `${aiUrl}/api/process/full`,
        { image_url: imageUrl, prescription_id: prescription._id.toString() },
        { timeout: AI_TIMEOUT_MS }
      );

      await _saveAIResult(result, prescription, user, io);
      return; // success — exit retry loop

    } catch (err) {
      lastError = err;
      const isTimeout = err.code === 'ECONNABORTED' || (err.message || '').includes('timeout');
      console.error(`❌ AI attempt ${attempt} failed: ${err.message}`);

      if (isTimeout && attempt < AI_MAX_RETRIES) {
        console.log(`⏳ Retrying in 8s (BERT model may still be loading on first run)…`);
        await new Promise(r => setTimeout(r, 8000));
        continue;
      }
      break;
    }
  }

  // All retries exhausted — mark as failed
  console.error(`❌ AI permanently failed after ${AI_MAX_RETRIES} attempts:`, lastError?.message);
  await Prescription.findByIdAndUpdate(prescription._id, {
    status: 'failed',
    ocrProcessingError: `AI error after ${AI_MAX_RETRIES} attempts: ${lastError?.message}`,
  });

  if (io) {
    io.to(`user_${user._id}`).emit('prescription_failed', {
      prescriptionId: prescription._id,
      error: 'AI processing failed. The model may still be loading — please try again in 1 minute.',
    });
  }
}

// ─── Save result from AI service into DB + notify ─────────────────────────────
async function _saveAIResult(result, prescription, user, io) {
  const updateData = {
    ocrRawText:            result.raw_text           || '',
    ocrConfidence:         result.ocr_confidence     || 0,
    writingStyle:          result.writing_style      || {},
    extractedMedicines:    result.medicines          || [],
    patientInfoExtracted:  result.patient_info       || {},
    doctorName:            result.doctor_info?.name  || '',
    doctorRegNo:           result.doctor_info?.reg_no || '',
    hospitalName:          result.doctor_info?.hospital || '',
    prescriptionDate:      result.prescription_date  || '',
    status: (result.success && result.medicines?.length > 0) ? 'extracted' : 'failed',
  };

  if (!result.success) {
    updateData.status = 'failed';
    updateData.ocrProcessingError = result.error || 'AI extraction failed';
  }

  await Prescription.findByIdAndUpdate(prescription._id, updateData);

  // Real-time notification to patient
  if (io) {
    io.to(`user_${user._id}`).emit('prescription_processed', {
      prescriptionId:  prescription._id,
      medicines:       result.medicines || [],
      confidence:      result.overall_confidence || 0,
      writingStyle:    result.writing_style || {},
      patientInfo:     result.patient_info || {},
      doctorInfo:      result.doctor_info || {},
      success:         result.success,
    });
  }

  // In-app notification
  await Notification.create({
    recipient: user._id,
    type:      'prescription_processed',
    title:     result.success ? '✅ Prescription Processed' : '❌ OCR Failed',
    message:   result.success
      ? `${result.medicines?.length || 0} medicine(s) extracted. Confidence: ${(result.overall_confidence || 0).toFixed(0)}%`
      : 'Could not read your prescription. Please upload a clearer image.',
    data: { prescriptionId: prescription._id },
  });

  // Email (non-blocking — ignore email errors)
  sendEmail({
    to:      user.email,
    subject: 'MediLink — Prescription Processed',
    html:    prescriptionProcessedTemplate(user.name, prescription._id),
  }).catch(() => {});

  console.log(`✅ Prescription ${prescription._id} processed — ${result.medicines?.length || 0} medicines, confidence ${result.overall_confidence || 0}%`);
}

// ─── Request quotes ────────────────────────────────────────────────────────────
exports.requestQuotes = async (req, res) => {
  try {
    const { id } = req.params;
    const { pharmacyIds } = req.body;

    const prescription = await Prescription.findOne({ _id: id, patient: req.user._id });
    if (!prescription) return res.status(404).json({ error: 'Prescription not found' });
    if (prescription.status !== 'extracted') {
      return res.status(400).json({ error: `Cannot request quotes in status: ${prescription.status}` });
    }

    let pharmacies = [];
    if (pharmacyIds?.length > 0) {
      pharmacies = await User.find({
        _id: { $in: pharmacyIds },
        role: 'pharmacy', isApproved: true, isActive: true,
      });
    } else {
      pharmacies = await User.find({ role: 'pharmacy', isApproved: true, isActive: true }).limit(10);
    }

    if (!pharmacies.length) return res.status(400).json({ error: 'No pharmacies available' });

    const quotationDocs = pharmacies.map(p => ({
      prescription: prescription._id,
      patient:      req.user._id,
      pharmacy:     p._id,
      status:       'pending',
      items:        prescription.extractedMedicines.map(m => ({
        medicineName: m.name,
        originalName: m.name,
        available:    true,
        quantity:     m.quantity || 1,
      })),
    }));

    await Quotation.insertMany(quotationDocs);
    await Prescription.findByIdAndUpdate(prescription._id, {
      status: 'quote_requested',
      sentToPharmacies: pharmacies.map(p => p._id),
    });

    if (req.io) {
      pharmacies.forEach(p => {
        req.io.to(`user_${p._id}`).emit('new_quote_request', {
          prescriptionId: prescription._id,
          patientName:    req.user.name,
          medicineCount:  prescription.extractedMedicines.length,
          isUrgent:       prescription.isUrgent,
        });
      });
    }

    res.json({ message: `Quote requested from ${pharmacies.length} pharmacies`, prescription });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

// ─── Get prescriptions list ────────────────────────────────────────────────────
exports.getMyPrescriptions = async (req, res) => {
  try {
    const { status, page = 1, limit = 10 } = req.query;
    const query = { patient: req.user._id };
    if (status) query.status = status;

    const total = await Prescription.countDocuments(query);
    const prescriptions = await Prescription.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit))
      .populate('selectedQuotation');

    res.json({ prescriptions, total, page: Number(page), pages: Math.ceil(total / limit) });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

// ─── Get single prescription ───────────────────────────────────────────────────
exports.getPrescriptionById = async (req, res) => {
  try {
    const prescription = await Prescription.findById(req.params.id)
      .populate('patient', 'name email phone patientProfile')
      .populate('selectedQuotation')
      .populate('sentToPharmacies', 'name pharmacyProfile');

    if (!prescription) return res.status(404).json({ error: 'Not found' });

    const isOwner   = prescription.patient._id.toString() === req.user._id.toString();
    const isAdmin   = req.user.role === 'admin';
    const isPharmacy = req.user.role === 'pharmacy';
    if (!isOwner && !isAdmin && !isPharmacy) return res.status(403).json({ error: 'Access denied' });

    res.json({ prescription });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

// ─── Update extracted medicines ───────────────────────────────────────────────
exports.updateMedicines = async (req, res) => {
  try {
    const { medicines } = req.body;
    const prescription = await Prescription.findOneAndUpdate(
      { _id: req.params.id, patient: req.user._id },
      { extractedMedicines: medicines },
      { new: true }
    );
    if (!prescription) return res.status(404).json({ error: 'Not found' });
    res.json({ prescription });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

// ─── Cancel ───────────────────────────────────────────────────────────────────
exports.cancelPrescription = async (req, res) => {
  try {
    const prescription = await Prescription.findOneAndUpdate(
      { _id: req.params.id, patient: req.user._id },
      { status: 'cancelled' },
      { new: true }
    );
    if (!prescription) return res.status(404).json({ error: 'Not found' });
    res.json({ message: 'Cancelled', prescription });
  } catch (err) { res.status(500).json({ error: err.message }); }
};
