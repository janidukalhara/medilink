const Quotation    = require('../models/Quotation');
const Prescription = require('../models/Prescription');
const Notification = require('../models/Notification');
const User         = require('../models/User');
const { sendEmail, quotationReceivedTemplate } = require('../utils/email');

// ─── Helper ───────────────────────────────────────────────────────────────────
function buildStatusQuery(pharmacyId, status) {
  if (status === 'all') return { pharmacy: pharmacyId };
  return {
    pharmacy: pharmacyId,
    $or: [
      { orderStatus: status },
      { status: status, orderStatus: { $exists: false } },
    ],
  };
}

// ─── Notify pharmacy their quote was rejected ─────────────────────────────────
async function notifyPharmacyRejected(quotation, io) {
  if (io) {
    io.to(`user_${quotation.pharmacy}`).emit('quotation_rejected', {
      quotationId:    quotation._id,
      prescriptionId: quotation.prescription,
      message:        'Your quotation was not selected by the patient.',
    });
  }
  await Notification.create({
    recipient: quotation.pharmacy,
    type:      'quote_rejected',
    title:     '❌ Quotation Not Selected',
    message:   'The patient selected another pharmacy for this prescription.',
    data:      { quotationId: quotation._id, prescriptionId: quotation.prescription },
  });
}

// ─── Pharmacy: get their requests ─────────────────────────────────────────────
exports.getPharmacyRequests = async (req, res) => {
  try {
    const { status = 'pending', page = 1, limit = 10 } = req.query;
    const query = buildStatusQuery(req.user._id, status);

    const total = await Quotation.countDocuments(query);
    const quotations = await Quotation.find(query)
      .populate('prescription', 'imageUrl extractedMedicines status createdAt isUrgent patientInfoExtracted doctorName')
      .populate('patient', 'name phone patientProfile')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));

    const normalised = quotations.map(q => {
      const obj = q.toObject();
      if (!obj.orderStatus && obj.status) obj.orderStatus = obj.status;
      return obj;
    });

    res.json({ quotations: normalised, total, pages: Math.ceil(total / limit) });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

// ─── Pharmacy: get single quotation ───────────────────────────────────────────
exports.getPharmacyQuotationById = async (req, res) => {
  try {
    const q = await Quotation.findOne({ _id: req.params.id, pharmacy: req.user._id })
      .populate('prescription', 'imageUrl extractedMedicines patientInfoExtracted doctorName hospitalName prescriptionDate ocrRawText writingStyle')
      .populate('patient', 'name phone email patientProfile');
    if (!q) return res.status(404).json({ error: 'Not found' });

    const obj = q.toObject();
    if (!obj.orderStatus && obj.status) obj.orderStatus = obj.status;
    res.json({ quotation: obj });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

// ─── Pharmacy: submit quotation ────────────────────────────────────────────────
exports.submitQuotation = async (req, res) => {
  try {
    const { items, deliveryFee, isDeliveryAvailable, estimatedTime, notes, fulfillmentType } = req.body;
    const quotation = await Quotation.findOne({ _id: req.params.id, pharmacy: req.user._id });
    if (!quotation) return res.status(404).json({ error: 'Not found' });

    const currentStatus = quotation.orderStatus || quotation.status;
    if (currentStatus === 'accepted') return res.status(400).json({ error: 'Already accepted' });

    const subtotal = items.reduce((s, i) => s + (i.available ? Number(i.totalPrice || 0) : 0), 0);
    const effectiveDeliveryFee = fulfillmentType === 'pickup' ? 0 : (deliveryFee || 0);

    quotation.orderStatus         = 'submitted';
    quotation.status              = 'submitted';
    quotation.items               = items;
    quotation.subtotal            = subtotal;
    quotation.deliveryFee         = effectiveDeliveryFee;
    quotation.totalAmount         = subtotal + effectiveDeliveryFee;
    quotation.isDeliveryAvailable = isDeliveryAvailable || false;
    // FIX: Store both delivery and pickup options properly
    quotation.fulfillmentType     = fulfillmentType || (isDeliveryAvailable ? 'delivery' : 'pickup');
    quotation.estimatedTime       = estimatedTime;
    quotation.notes               = notes;
    quotation.validUntil          = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await quotation.save();

    await Prescription.findByIdAndUpdate(quotation.prescription, { status: 'quotes_received' });

    const patient  = await User.findById(quotation.patient);
    const pharmacy = req.user;

    if (req.io) {
      req.io.to(`user_${quotation.patient}`).emit('new_quotation', {
        quotationId:    quotation._id,
        prescriptionId: quotation.prescription,
        pharmacyName:   pharmacy.name,
        pharmacyId:     pharmacy._id,
        totalAmount:    quotation.totalAmount,
      });
    }

    await Notification.create({
      recipient: quotation.patient,
      type:      'quote_received',
      title:     '💰 New Quotation Received',
      message:   `${pharmacy.name} submitted a quote for LKR ${quotation.totalAmount.toFixed(2)}.`,
      data:      { quotationId: quotation._id, prescriptionId: quotation.prescription },
    });

    if (patient) {
      sendEmail({ to: patient.email, subject: 'MediLink — New Quotation',
        html: quotationReceivedTemplate(patient.name, pharmacy.name, quotation.prescription) }).catch(() => {});
    }

    res.json({ message: 'Quotation submitted', quotation });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

// ─── Patient: get quotations for a prescription ────────────────────────────────
exports.getPrescriptionQuotations = async (req, res) => {
  try {
    const visibleStatuses = ['submitted','accepted','rejected','confirmed','preparing',
                             'dispatched','delivered','pickup_ready','picked_up','completed'];
    const quotations = await Quotation.find({
      prescription: req.params.prescriptionId,
      patient:      req.user._id,
      $or: [
        { orderStatus: { $in: visibleStatuses } },
        { status: { $in: visibleStatuses }, orderStatus: { $exists: false } },
      ],
    })
      .populate('pharmacy', 'name email phone pharmacyProfile')
      .sort({ totalAmount: 1 });

    const normalised = quotations.map(q => {
      const obj = q.toObject();
      if (!obj.orderStatus && obj.status) obj.orderStatus = obj.status;
      return obj;
    });

    res.json({ quotations: normalised });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

// ─── Patient: accept quotation ─────────────────────────────────────────────────
exports.acceptQuotation = async (req, res) => {
  try {
    const quotation = await Quotation.findOne({ _id: req.params.id, patient: req.user._id });
    if (!quotation) return res.status(404).json({ error: 'Not found' });

    const currentStatus = quotation.orderStatus || quotation.status;
    if (currentStatus !== 'submitted') {
      return res.status(400).json({ error: `Cannot accept from status: ${currentStatus}` });
    }

    quotation.orderStatus = 'accepted';
    quotation.status      = 'accepted';
    quotation.acceptedAt  = new Date();
    await quotation.save();

    // FIX: Auto-reject all other submitted quotes and notify each pharmacy
    const othersToReject = await Quotation.find({
      prescription: quotation.prescription,
      _id: { $ne: quotation._id },
      $or: [{ orderStatus: 'submitted' }, { status: 'submitted' }],
    });

    for (const other of othersToReject) {
      other.orderStatus = 'rejected';
      other.status      = 'rejected';
      other.rejectedAt  = new Date();
      await other.save();
      // FIX: Notify each rejected pharmacy via socket + in-app notification
      await notifyPharmacyRejected(other, req.io);
    }

    await Prescription.findByIdAndUpdate(quotation.prescription, {
      status:            'accepted',
      selectedQuotation: quotation._id,
      fulfillmentType:   quotation.fulfillmentType,
      acceptedAt:        new Date(),
    });

    if (req.io) {
      req.io.to(`user_${quotation.pharmacy}`).emit('quotation_accepted', {
        quotationId:    quotation._id,
        prescriptionId: quotation.prescription,
      });
    }

    await Notification.create({
      recipient: quotation.pharmacy,
      type:      'quote_accepted',
      title:     '🎉 Quotation Accepted!',
      message:   `Your quote of LKR ${quotation.totalAmount.toFixed(2)} was accepted.`,
      data:      { quotationId: quotation._id, prescriptionId: quotation.prescription },
    });

    res.json({ message: 'Quotation accepted', quotation });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

// ─── Patient: change fulfillment type (delivery → pickup or pickup → delivery) ─
exports.changeFulfillmentType = async (req, res) => {
  try {
    const { fulfillmentType } = req.body;
    if (!['delivery', 'pickup'].includes(fulfillmentType)) {
      return res.status(400).json({ error: 'fulfillmentType must be delivery or pickup' });
    }

    const quotation = await Quotation.findOne({ _id: req.params.id, patient: req.user._id })
      .populate('pharmacy', 'name pharmacyProfile');
    if (!quotation) return res.status(404).json({ error: 'Not found' });

    const currentStatus = quotation.orderStatus || quotation.status;
    if (!['accepted', 'confirmed'].includes(currentStatus)) {
      return res.status(400).json({ error: `Cannot change fulfillment in status: ${currentStatus}` });
    }

    // If switching to pickup: remove delivery fee
    const previousType = quotation.fulfillmentType;
    // Fallback: some old documents may have subtotal=0 but totalAmount is correct
    const subtotal = quotation.subtotal > 0
      ? quotation.subtotal
      : (quotation.totalAmount || 0) - (quotation.deliveryFee || 0);
    const newDeliveryFee = fulfillmentType === 'pickup' ? 0 : (quotation.deliveryFee || 0);
    const newTotal = subtotal + newDeliveryFee;

    quotation.fulfillmentType = fulfillmentType;
    quotation.deliveryFee     = newDeliveryFee;
    quotation.subtotal        = subtotal;
    quotation.totalAmount     = newTotal;
    await quotation.save();

    // Update prescription fulfillment type too
    await Prescription.findByIdAndUpdate(quotation.prescription, { fulfillmentType });

    // Notify pharmacy of the change
    if (req.io) {
      req.io.to(`user_${quotation.pharmacy._id}`).emit('fulfillment_changed', {
        quotationId:     quotation._id,
        prescriptionId:  quotation.prescription,
        fulfillmentType,
        previousType,
        newTotal,
        patientName:     req.user.name,
      });
    }

    await Notification.create({
      recipient: quotation.pharmacy._id,
      type:      'fulfillment_changed',
      title:     fulfillmentType === 'pickup' ? '🏪 Patient Will Pick Up' : '🚚 Patient Wants Delivery',
      message:   fulfillmentType === 'pickup'
        ? `${req.user.name} changed to pickup. Delivery fee removed. New total: LKR ${newTotal.toFixed(2)}.`
        : `${req.user.name} changed to delivery. New total: LKR ${newTotal.toFixed(2)}.`,
      data: { quotationId: quotation._id, prescriptionId: quotation.prescription },
    });

    res.json({
      message: `Fulfillment changed to ${fulfillmentType}`,
      quotation,
      savings: previousType === 'delivery' && fulfillmentType === 'pickup'
        ? (quotation.deliveryFee || 0)
        : 0,
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

// ─── Patient: mark order completed ────────────────────────────────────────────
exports.patientCompleteOrder = async (req, res) => {
  try {
    const quotation = await Quotation.findOne({ _id: req.params.id, patient: req.user._id });
    if (!quotation) return res.status(404).json({ error: 'Not found' });

    const currentStatus = quotation.orderStatus || quotation.status;
    const completable   = ['delivered', 'pickup_ready', 'picked_up'];
    if (!completable.includes(currentStatus)) {
      return res.status(400).json({ error: `Cannot complete order from status: ${currentStatus}` });
    }

    quotation.orderStatus = 'completed';
    quotation.status      = 'completed';
    quotation.completedAt = new Date();
    await quotation.save();

    await Prescription.findByIdAndUpdate(quotation.prescription, {
      status: 'completed', completedAt: new Date(),
    });

    if (req.io) {
      req.io.to(`user_${quotation.pharmacy}`).emit('order_completed', {
        quotationId: quotation._id, prescriptionId: quotation.prescription,
      });
    }

    await Notification.create({
      recipient: quotation.pharmacy,
      type:      'order_completed',
      title:     '✅ Order Completed',
      message:   'Patient confirmed receipt of their medicines.',
      data:      { quotationId: quotation._id },
    });

    res.json({ message: 'Order completed', quotation });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

// ─── Pharmacy: update order status ─────────────────────────────────────────────
exports.updateOrderStatus = async (req, res) => {
  try {
    const { status, fulfillmentType } = req.body;

    const PHARMACY_STATUSES = ['confirmed','preparing','dispatched','delivered','pickup_ready','picked_up'];
    if (!PHARMACY_STATUSES.includes(status)) {
      return res.status(400).json({ error: `Invalid status: ${status}` });
    }

    const quotation = await Quotation.findOne({ _id: req.params.id, pharmacy: req.user._id });
    if (!quotation) return res.status(404).json({ error: 'Not found' });

    quotation.orderStatus = status;
    quotation.status      = status;
    if (fulfillmentType) quotation.fulfillmentType = fulfillmentType;
    await quotation.save();

    const PRESCRIPTION_MAP = {
      confirmed: 'confirmed', preparing: 'preparing', dispatched: 'dispatched',
      delivered: 'delivered', pickup_ready: 'pickup_ready', picked_up: 'delivered',
    };
    await Prescription.findByIdAndUpdate(quotation.prescription, {
      status: PRESCRIPTION_MAP[status] || status,
    });

    const LABELS = {
      confirmed:    '📦 Order Confirmed',    preparing:    '🧴 Preparing Your Medicines',
      dispatched:   '🚚 Out for Delivery',   delivered:    '🚪 Delivered',
      pickup_ready: '🏪 Ready for Pickup',   picked_up:    '✅ Medicines Picked Up',
    };
    const MESSAGES = {
      confirmed:    'Your order has been confirmed by the pharmacy.',
      preparing:    'The pharmacy is now preparing your medicines.',
      dispatched:   'Your medicines are on the way!',
      delivered:    'Your medicines have been delivered. Please confirm receipt.',
      pickup_ready: 'Your medicines are ready for collection at the pharmacy.',
      picked_up:    'The pharmacy has marked your medicines as picked up.',
    };

    if (req.io) {
      req.io.to(`user_${quotation.patient}`).emit('order_status_updated', {
        prescriptionId: quotation.prescription,
        quotationId:    quotation._id,
        status,
        label:          LABELS[status],
      });
    }

    await Notification.create({
      recipient: quotation.patient,
      type:      `order_${status}`,
      title:     LABELS[status] || status,
      message:   MESSAGES[status] || `Order status: ${status}`,
      data:      { prescriptionId: quotation.prescription, quotationId: quotation._id },
    });

    res.json({ message: `Status → ${status}`, quotation });
  } catch (err) { res.status(500).json({ error: err.message }); }
};
