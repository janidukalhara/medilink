const Message = require('../models/Message');
const Prescription = require('../models/Prescription');
const Quotation = require('../models/Quotation');

// Check access rights
async function hasAccess(prescriptionId, user) {
  const prescription = await Prescription.findById(prescriptionId);
  if (!prescription) return false;
  if (user.role === 'admin') return true;
  if (user.role === 'patient') return prescription.patient.toString() === user._id.toString();
  if (user.role === 'pharmacy') {
    const q = await Quotation.findOne({ prescription: prescriptionId, pharmacy: user._id });
    return !!q;
  }
  return false;
}

// GET messages for a prescription (scoped to pharmacy thread if pharmacyId given)
exports.getMessages = async (req, res) => {
  try {
    const { prescriptionId } = req.params;
    const { pharmacyId }     = req.query;

    if (!await hasAccess(prescriptionId, req.user)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const query = { prescriptionId };

    if (pharmacyId) {
      // Patient asking for one specific pharmacy's thread
      query.pharmacyId = pharmacyId;
    } else if (req.user.role === 'pharmacy') {
      // Pharmacy always sees only their own thread
      query.pharmacyId = req.user._id;
    }
    // Admin or patient without pharmacyId → all messages

    const messages = await Message.find(query)
      .populate('sender', 'name role')
      .sort({ createdAt: 1 });

    // Mark unread
    await Message.updateMany(
      { ...query, sender: { $ne: req.user._id }, isRead: false },
      { isRead: true, readAt: new Date() }
    );

    res.json({ messages });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

// POST send message via REST (backup path — primary is Socket.IO)
exports.sendMessage = async (req, res) => {
  try {
    const { prescriptionId } = req.params;
    const { content, pharmacyId } = req.body;

    if (!await hasAccess(prescriptionId, req.user)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    let scopedPharmacyId = pharmacyId || null;
    if (req.user.role === 'pharmacy') scopedPharmacyId = req.user._id;

    const message = await Message.create({
      prescriptionId,
      pharmacyId: scopedPharmacyId,
      sender:     req.user._id,
      senderRole: req.user.role,
      content,
    });

    const populated = await message.populate('sender', 'name role');

    const roomKey = scopedPharmacyId
      ? `${prescriptionId}_${scopedPharmacyId}`
      : prescriptionId;

    if (req.io) {
      req.io.to(`room_${roomKey}`).emit('new_message', {
        _id:        populated._id,
        sender:     populated.sender,
        senderRole: populated.senderRole,
        content:    populated.content,
        createdAt:  populated.createdAt,
        roomKey,
      });
    }

    res.status(201).json({ message: populated });
  } catch (err) { res.status(500).json({ error: err.message }); }
};
