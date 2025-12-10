const { Appointment } = require('../models');
const { Op } = require('sequelize');
const sendEmail = require('../utils/emainSender');

// Helper: Generate a beautiful, informative HTML email for appointment actions
function generateAppointmentEmail({ name, service, date, time, address, notes, status, action }) {
  let actionTitle = '';
  let intro = '';
  let color = '#4CAF50';
  let icon = '';
  let mainMessage = '';
  let statusBadge = '';

  switch (action) {
    case 'booked':
      actionTitle = 'Appointment Booked Successfully!';
      intro = 'Dear Customer,';
      color = '#4CAF50';
      icon = '✅';
      mainMessage = 'Thank you for booking your health screening with us.<br><br>Your appointment has been successfully booked/confirmed.<br><br>Our executive will contact you soon for further process.';
      break;
    case 'updated':
      actionTitle = 'Appointment Updated';
      intro = `Dear <b>${name}</b>,<br>Your appointment details have been <b>updated</b>.`;
      color = '#2196F3';
      icon = '✏️';
      mainMessage = 'Please review your updated appointment details below. If you have any questions, feel free to contact us.';
      break;
    case 'status':
      actionTitle = 'Appointment Status Changed';
      intro = `Dear <b>${name}</b>,<br>Your appointment status is now:`;
      color = status === 'cancelled' ? '#F44336' : '#FFC107';
      icon = status === 'cancelled' ? '❌' : '🔔';
      mainMessage = status === 'cancelled'
        ? 'We regret to inform you that your appointment has been <b>cancelled</b>. If this is a mistake or you wish to reschedule, please contact us.'
        : `Your appointment status is now <b>${status.toUpperCase()}</b>.`;
      break;
    case 'deleted':
      actionTitle = 'Appointment Cancelled';
      intro = `Dear <b>${name}</b>,<br>Your appointment has been <b>cancelled</b>.`;
      color = '#F44336';
      icon = '❌';
      mainMessage = 'We are sorry to see you cancel. If you wish to book again, you are always welcome!';
      break;
    default:
      actionTitle = 'Appointment Notification';
      intro = '';
      icon = '📅';
      mainMessage = '';
  }

  // Status badge
  if (status) {
    let badgeColor = '#4CAF50';
    switch (status) {
      case 'pending': badgeColor = '#FFC107'; break;
      case 'confirmed': badgeColor = '#2196F3'; break;
      case 'completed': badgeColor = '#4CAF50'; break;
      case 'cancelled': badgeColor = '#F44336'; break;
      default: badgeColor = '#888';
    }
    statusBadge = `<span style="display:inline-block;padding:4px 12px;border-radius:12px;background:${badgeColor};color:#fff;font-size:13px;font-weight:bold;letter-spacing:1px;">${status.toUpperCase()}</span>`;
  }

  // Service pretty name
  const serviceNames = {
    'breast-scan': 'Breast Scan',
    'ecg': 'ECG',
    'comprehensive': 'Comprehensive Checkup'
  };
  const prettyService = serviceNames[service] || service;

  // Time pretty
  const timeNames = {
    'morning': 'Morning (8:00 AM - 12:00 PM)',
    'afternoon': 'Afternoon (12:00 PM - 4:00 PM)',
    'evening': 'Evening (4:00 PM - 8:00 PM)'
  };
  const prettyTime = timeNames[time] || time;

  // Simple template for booked appointments
  if (action === 'booked') {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="margin: 0; padding: 0; background-color: #ffffff;">
        <div style="font-family: Arial, Helvetica, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 30px;">
          <div style="margin-bottom: 32px;">
            <p style="font-size: 16px; color: #2c3e50; margin: 0 0 16px 0; line-height: 1.6;">Dear Customer,</p>
            <p style="font-size: 16px; color: #2c3e50; margin: 0 0 16px 0; line-height: 1.6;">Thank you for booking your health screening with us.</p>
            <p style="font-size: 16px; color: #2c3e50; margin: 0 0 16px 0; line-height: 1.6;">Your appointment has been successfully booked/confirmed.</p>
            <p style="font-size: 16px; color: #2c3e50; margin: 0; line-height: 1.6;">Our executive will contact you soon for further process.</p>
          </div>
          <div style="margin-top: 32px; padding-top: 24px; border-top: 1px solid #e8e8e8;">
            <p style="font-size: 16px; color: #2c3e50; margin: 0 0 8px 0; font-weight: 500;">Team D3S Healthcare</p>
            <p style="font-size: 14px; color: #7f8c8d; margin: 0; line-height: 1.6;">For any queries contact us at <a href="tel:+916355462935" style="color: #2c3e50; text-decoration: none;">+91 6355 462 935</a></p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  // Detailed template for other actions (updated, status, deleted)
  return `
    <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 540px; margin: 32px auto; border:1px solid #e0e0e0; border-radius:12px; overflow:hidden; box-shadow:0 2px 12px rgba(0,0,0,0.06); background:#fff;">
      <div style="background:${color};color:#fff;padding:24px 32px;display:flex;align-items:center;">
        <span style="font-size:2.2rem; margin-right:16px;">${icon}</span>
        <div>
          <h2 style="margin:0 0 4px 0;font-size:1.5rem;letter-spacing:0.5px;">${actionTitle}</h2>
          ${statusBadge}
        </div>
      </div>
      <div style="padding:32px;">
        <p style="font-size:17px; margin:0 0 12px 0;">${intro}</p>
        <p style="font-size:15px; color:#444; margin:0 0 18px 0;">${mainMessage}</p>
        <div style="margin:24px 0 0 0;">
          <table style="width:100%;border-collapse:collapse;font-size:15px;">
            <tr>
              <td style="font-weight:600;padding:8px 0;width:120px;">Service:</td>
              <td style="padding:8px 0;">${prettyService}</td>
            </tr>
            <tr>
              <td style="font-weight:600;padding:8px 0;">Date:</td>
              <td style="padding:8px 0;">${date}</td>
            </tr>
            <tr>
              <td style="font-weight:600;padding:8px 0;">Time:</td>
              <td style="padding:8px 0;">${prettyTime}</td>
            </tr>
            <tr>
              <td style="font-weight:600;padding:8px 0;">Address:</td>
              <td style="padding:8px 0;">${address}</td>
            </tr>
            ${notes ? `<tr><td style="font-weight:600;padding:8px 0;">Notes:</td><td style="padding:8px 0;">${notes}</td></tr>` : ''}
            ${status ? `<tr><td style="font-weight:600;padding:8px 0;">Status:</td><td style="padding:8px 0;">${statusBadge}</td></tr>` : ''}
          </table>
        </div>
        <div style="margin-top:32px; padding:18px 20px; background:#f7f7f7; border-radius:8px;">
          <p style="margin:0; font-size:14px; color:#666;">
            <b>Need to make changes?</b> Simply reply to this email or contact our support team.<br>
            <span style="color:#888;">Thank you for choosing <b>D3S App</b>. We are committed to your health and well-being.</span>
          </p>
        </div>
        <div style="margin-top:24px;text-align:center;">
          <a href="https://d3sapp.com" style="display:inline-block;padding:10px 28px;background:${color};color:#fff;border-radius:6px;text-decoration:none;font-weight:600;font-size:15px;box-shadow:0 2px 6px rgba(0,0,0,0.07);margin-top:10px;">Visit Our Website</a>
        </div>
      </div>
      <div style="background:#f0f0f0;padding:14px 0;text-align:center;font-size:13px;color:#888;">
        &copy; ${new Date().getFullYear()} D3S App. All rights reserved.
      </div>
    </div>
  `;
}

// ➕ Create Appointment
exports.createAppointment = async (req, res) => {
  try {
    const { name, email, phone, service, date, time, address, notes } = req.body;

    // Validate required fields
    if (!name || !email || !phone || !service || !date || !time || !address) {
      return res.status(400).json({ error: '❌ All required fields must be provided' });
    }

    // Validate service type
    const validServices = ['breast-scan', 'ecg', 'comprehensive'];
    if (!validServices.includes(service)) {
      return res.status(400).json({ error: '❌ Invalid service type' });
    }

    // Validate time slot
    const validTimeSlots = ['morning', 'afternoon', 'evening'];
    if (!validTimeSlots.includes(time)) {
      return res.status(400).json({ error: '❌ Invalid time slot' });
    }

    // Check if appointment date is not in the past
    const appointmentDate = new Date(date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (appointmentDate < today) {
      return res.status(400).json({ error: '❌ Cannot book appointment for past dates' });
    }

    // Check for duplicate appointments (same phone/email, date, and time)
    const existingAppointment = await Appointment.findOne({
      where: {
        [Op.or]: [{ phone }, { email }],
        date,
        time,
        status: { [Op.not]: 'cancelled' }
      }
    });

    if (existingAppointment) {
      return res.status(400).json({ error: '❌ You already have an appointment at this time slot' });
    }

    const appointment = await Appointment.create({
      name,
      email,
      phone,
      service,
      date,
      time,
      address,
      notes: notes || null,
      status: 'pending'
    });

    // Send booking confirmation email
    try {
      await sendEmail(
        email,
        'Your Appointment is Booked - D3S App',
        undefined,
        generateAppointmentEmail({
          name,
          service,
          date,
          time,
          address,
          notes,
          status: 'pending',
          action: 'booked'
        })
      );
    } catch (mailErr) {
      // Don't block response if email fails, but log error
      console.error('Failed to send appointment booking email:', mailErr);
    }

    res.status(201).json({
      message: '✅ Appointment booked successfully',
      appointment
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// 📋 Get All Appointments
exports.getAllAppointments = async (req, res) => {
  try {
    const { status, service, date, page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;

    const where = {};

    if (status) where.status = status;
    if (service) where.service = service;
    if (date) where.date = date;

    const { count, rows: appointments } = await Appointment.findAndCountAll({
      where,
      order: [['date', 'ASC'], ['time', 'ASC']],
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    res.status(200).json({
      appointments,
      pagination: {
        total: count,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(count / limit)
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// 🔍 Get Appointment by ID
exports.getAppointmentById = async (req, res) => {
  try {
    const { id } = req.params;
    const appointment = await Appointment.findByPk(id);

    if (!appointment) {
      return res.status(404).json({ error: '❌ Appointment not found' });
    }

    res.status(200).json(appointment);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ✏️ Update Appointment
exports.updateAppointment = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, phone, service, date, time, address, notes, status } = req.body;

    const appointment = await Appointment.findByPk(id);
    if (!appointment) {
      return res.status(404).json({ error: '❌ Appointment not found' });
    }

    // Validate service type if provided
    if (service) {
      const validServices = ['breast-scan', 'ecg', 'comprehensive'];
      if (!validServices.includes(service)) {
        return res.status(400).json({ error: '❌ Invalid service type' });
      }
    }

    // Validate time slot if provided
    if (time) {
      const validTimeSlots = ['morning', 'afternoon', 'evening'];
      if (!validTimeSlots.includes(time)) {
        return res.status(400).json({ error: '❌ Invalid time slot' });
      }
    }

    // Validate status if provided
    if (status) {
      const validStatuses = ['pending', 'confirmed', 'completed', 'cancelled'];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({ error: '❌ Invalid status' });
      }
    }

    // Check if new date is not in the past
    if (date) {
      const appointmentDate = new Date(date);
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      if (appointmentDate < today) {
        return res.status(400).json({ error: '❌ Cannot reschedule appointment to past dates' });
      }
    }

    const updatedData = {};
    if (name) updatedData.name = name;
    if (email) updatedData.email = email;
    if (phone) updatedData.phone = phone;
    if (service) updatedData.service = service;
    if (date) updatedData.date = date;
    if (time) updatedData.time = time;
    if (address) updatedData.address = address;
    if (notes !== undefined) updatedData.notes = notes;
    if (status) updatedData.status = status;

    await appointment.update(updatedData);

    // Send update email if email is present
    try {
      await sendEmail(
        updatedData.email || appointment.email,
        'Your Appointment has been Updated - D3S App',
        undefined,
        generateAppointmentEmail({
          name: updatedData.name || appointment.name,
          service: updatedData.service || appointment.service,
          date: updatedData.date || appointment.date,
          time: updatedData.time || appointment.time,
          address: updatedData.address || appointment.address,
          notes: updatedData.notes !== undefined ? updatedData.notes : appointment.notes,
          status: updatedData.status || appointment.status,
          action: 'updated'
        })
      );
    } catch (mailErr) {
      console.error('Failed to send appointment update email:', mailErr);
    }

    res.status(200).json({
      message: '✅ Appointment updated successfully',
      appointment
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// 🔄 Update Appointment Status
exports.updateAppointmentStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const validStatuses = ['pending', 'confirmed', 'completed', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: '❌ Invalid status' });
    }

    const appointment = await Appointment.findByPk(id);
    if (!appointment) {
      return res.status(404).json({ error: '❌ Appointment not found' });
    }

    await appointment.update({ status });

    // Send status update email
    try {
      await sendEmail(
        appointment.email,
        `Your Appointment Status is now ${status.toUpperCase()} - D3S App`,
        undefined,
        generateAppointmentEmail({
          name: appointment.name,
          service: appointment.service,
          date: appointment.date,
          time: appointment.time,
          address: appointment.address,
          notes: appointment.notes,
          status,
          action: 'status'
        })
      );
    } catch (mailErr) {
      console.error('Failed to send appointment status email:', mailErr);
    }

    res.status(200).json({
      message: `✅ Appointment status updated to ${status}`,
      appointment
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// 🗑️ Delete Appointment
exports.deleteAppointment = async (req, res) => {
  try {
    const { id } = req.params;
    const appointment = await Appointment.findByPk(id);

    if (!appointment) {
      return res.status(404).json({ error: '❌ Appointment not found' });
    }

    await appointment.destroy();

    // Send cancellation email
    try {
      await sendEmail(
        appointment.email,
        'Your Appointment has been Cancelled - D3S App',
        undefined,
        generateAppointmentEmail({
          name: appointment.name,
          service: appointment.service,
          date: appointment.date,
          time: appointment.time,
          address: appointment.address,
          notes: appointment.notes,
          status: 'cancelled',
          action: 'deleted'
        })
      );
    } catch (mailErr) {
      console.error('Failed to send appointment cancellation email:', mailErr);
    }

    res.status(200).json({ message: '✅ Appointment deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// 🔎 Search Appointments
exports.searchAppointments = async (req, res) => {
  try {
    const { query } = req.query;

    if (!query) {
      return res.status(400).json({ error: '❌ Search query is required' });
    }

    const appointments = await Appointment.findAll({
      where: {
        [Op.or]: [
          { name: { [Op.like]: `%${query}%` } },
          { email: { [Op.like]: `%${query}%` } },
          { phone: { [Op.like]: `%${query}%` } }
        ]
      },
      order: [['date', 'ASC'], ['time', 'ASC']]
    });

    res.status(200).json({
      count: appointments.length,
      appointments
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ⏰ Check Availability
exports.checkAvailability = async (req, res) => {
  try {
    const { date, time } = req.query;

    if (!date || !time) {
      return res.status(400).json({ error: '❌ Date and time are required' });
    }

    // Validate time slot
    const validTimeSlots = ['morning', 'afternoon', 'evening'];
    if (!validTimeSlots.includes(time)) {
      return res.status(400).json({ error: '❌ Invalid time slot' });
    }

    const appointmentCount = await Appointment.count({
      where: {
        date,
        time,
        status: { [Op.not]: 'cancelled' }
      }
    });

    // Assuming maximum 10 appointments per time slot
    const maxAppointments = 10;
    const isAvailable = appointmentCount < maxAppointments;

    res.status(200).json({
      date,
      time,
      isAvailable,
      currentBookings: appointmentCount,
      maxCapacity: maxAppointments,
      remainingSlots: Math.max(0, maxAppointments - appointmentCount)
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};