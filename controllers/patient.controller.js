const { Patient, Hospital } = require('../models');
const { Op } = require('sequelize');

// 👶 Create a new patient
exports.createPatient = async (req, res) => {
  try {
    const { firstName, lastName, age, weight, height, contact, gender, address, adharNumber, email, hospitalId } = req.body;

    const hospital = await Hospital.findByPk(hospitalId);
    if (!hospital) {
      console.error(`❌ Hospital not found with ID: ${hospitalId}`);
      return res.status(404).json({ error: '❌ Hospital not found' });
    }

    const patient = await Patient.create({ 
      firstName, 
      lastName, 
      age, 
      weight, 
      height, 
      contact, 
      gender, 
      address, 
      adharNumber, 
      email, 
      hospitalId 
    });
    
    console.log(`✅ Patient created successfully with ID: ${patient.id}`);
    res.status(201).json(patient);
  } catch (error) {
    console.error('❌ Error creating patient:', {
      error: error.message,
      stack: error.stack,
      requestBody: req.body
    });
    res.status(500).json({ 
      error: 'An error occurred while creating the patient',
      details: error.message 
    });
  }
};

// 📋 Get all patients for a specific hospital
exports.getPatientsByHospital = async (req, res) => {
  try {
    const { hospitalId } = req.params;

    const patients = await Patient.findAll({
      where: { hospitalId },
      include: [{ model: Hospital, as: 'hospital' }]
    });

    if (!patients.length) {
      return res.status(200).json({ 
        patients: [], 
        message: '❌ No patients found for this hospital' 
      });
    }

    res.status(200).json(patients);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// 🔍 Get a single patient by ID
exports.getPatientById = async (req, res) => {
  try {
    const { id } = req.params;

    const patient = await Patient.findByPk(id, { 
      include: [{ model: Hospital, as: 'hospital' }] 
    });
    
    if (!patient) return res.status(404).json({ error: '❌ Patient not found' });

    res.status(200).json(patient);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// 🛠️ Update a patient
exports.updatePatient = async (req, res) => {
  try {
    const { id } = req.params;
    const { firstName, lastName, age, weight, height, contact, gender, address, adharNumber, email } = req.body;

    const patient = await Patient.findByPk(id);
    if (!patient) return res.status(404).json({ error: '❌ Patient not found' });

    await patient.update({ 
      firstName, 
      lastName, 
      age, 
      weight, 
      height, 
      contact, 
      gender, 
      address, 
      adharNumber, 
      email 
    });
    
    res.status(200).json(patient);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// 🗑️ Delete a patient
exports.deletePatient = async (req, res) => {
  try {
    const { id } = req.params;

    const patient = await Patient.findByPk(id);
    if (!patient) return res.status(404).json({ error: '❌ Patient not found' });

    // Force delete to bypass foreign key constraints
    await patient.destroy({ force: true });
    res.status(200).json({ message: '✅ Patient deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// 🔍 Search patients
exports.searchPatients = async (req, res) => {
  try {
    const { query, hospitalId } = req.query;
    
    const whereClause = { hospitalId };
    
    if (query) {
      whereClause[Op.or] = [
        { firstName: { [Op.like]: `%${query}%` } },
        { lastName: { [Op.like]: `%${query}%` } },
        { adharNumber: { [Op.like]: `%${query}%` } },
        { email: { [Op.like]: `%${query}%` } },
        { contact: { [Op.like]: `%${query}%` } }
      ];
    }
    
    const patients = await Patient.findAll({
      where: whereClause,
      include: [{ model: Hospital, as: 'hospital' }]
    });
    
    res.status(200).json(patients);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
