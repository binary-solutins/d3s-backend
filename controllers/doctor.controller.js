const { Doctor, Hospital, Patient } = require('../models');
const { Op } = require('sequelize');

// ➕ Create Doctor
exports.createDoctor = async (req, res) => {
  try {
    const { name, specialization, designation, hospitalId } = req.body;

    const hospital = await Hospital.findByPk(hospitalId);
    if (!hospital) return res.status(404).json({ error: '❌ Hospital not found' });

    const doctor = await Doctor.create({ name, specialization, designation, hospitalId });
    res.status(201).json(doctor);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// 🏥 Get Doctors by Hospital
exports.getDoctorsByHospital = async (req, res) => {
  try {
    const { hospitalId } = req.params;

    const doctors = await Doctor.findAll({
      where: { hospitalId },
    });

    if (!doctors.length) {
      return res.status(200).json({ 
        doctors: [], 
        message: '❌ No doctors found for this hospital' 
      });
    }

    res.status(200).json(doctors);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// 🔍 Get Doctor by ID
exports.getDoctorById = async (req, res) => {
  try {
    const { id } = req.params;

    const doctor = await Doctor.findByPk(id, {
    });
    

    if (!doctor) return res.status(404).json({ error: '❌ Doctor not found' });

    res.status(200).json(doctor);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ✏️ Update Doctor
exports.updateDoctor = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, specialization, designation } = req.body;

    const doctor = await Doctor.findByPk(id);
    if (!doctor) return res.status(404).json({ error: '❌ Doctor not found' });

    await doctor.update({ name, specialization, designation });
    res.status(200).json(doctor);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// 🗑️ Delete Doctor
exports.deleteDoctor = async (req, res) => {
  try {
    const { id } = req.params;

    const doctor = await Doctor.findByPk(id);
    if (!doctor) return res.status(404).json({ error: '❌ Doctor not found' });

    await doctor.destroy();
    res.status(200).json({ message: '✅ Doctor deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// 🔎 Search Doctor by name/specialization
exports.searchDoctors = async (req, res) => {
  try {
    const { query } = req.query;

    const doctors = await Doctor.findAll({
      where: {
        [Op.or]: [
          { name: { [Op.like]: `%${query}%` } },
          { specialization: { [Op.like]: `%${query}%` } },
          { designation: { [Op.like]: `%${query}%` } }
        ]
      },
      include: [Hospital]
    });

    res.status(200).json(doctors);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
