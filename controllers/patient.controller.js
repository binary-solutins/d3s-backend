const { Patient, Hospital } = require('../models');
const { Op } = require('sequelize');

// 👶 Create a new patient
exports.createPatient = async (req, res) => {
  try {
    const {
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
      hospitalId,
      familyHistoryOfCancer,
      breastLump,
      breastPain,
      changeInBreastAppearance,
      breastSkinChanges,
      nippleDischarge,
      nippleSymptoms,
      previousBreastScreening,
      previousBreastProceduresOrAbnormalReport
    } = req.body;

    console.log('📥 Received request to create patient with data:', {
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
      hospitalId,
      familyHistoryOfCancer,
      breastLump,
      breastPain,
      changeInBreastAppearance,
      breastSkinChanges,
      nippleDischarge,
      nippleSymptoms,
      previousBreastScreening,
      previousBreastProceduresOrAbnormalReport
    });

    const hospital = await Hospital.findByPk(hospitalId);
    if (!hospital) {
      console.error(`❌ Hospital not found with ID: ${hospitalId}`, {
        timestamp: new Date().toISOString(),
        requestBody: req.body
      });
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
      hospitalId,
      familyHistoryOfCancer,
      breastLump,
      breastPain,
      changeInBreastAppearance,
      breastSkinChanges,
      nippleDischarge,
      nippleSymptoms,
      previousBreastScreening,
      previousBreastProceduresOrAbnormalReport,
      isDeleted: false
    });
    
    console.log(`✅ Patient created successfully with ID: ${patient.id}`, {
      patientId: patient.id,
      timestamp: new Date().toISOString(),
      hospitalId: hospitalId
    });
    
    res.status(201).json(patient);
  } catch (error) {
    console.error('❌ Error creating patient:', {
      timestamp: new Date().toISOString(),
      error: error.message,
      stack: error.stack,
      requestBody: req.body,
      validationErrors: error.errors ? error.errors.map(err => ({
        field: err.path,
        message: err.message,
        type: err.type
      })) : null
    });
    
    res.status(500).json({ 
      error: 'An error occurred while creating the patient',
      details: error.message,
      validationErrors: error.errors ? error.errors.map(err => ({
        field: err.path,
        message: err.message
      })) : null
    });
  }
};

// 📋 Get all patients for a specific hospital (excluding deleted ones)
exports.getPatientsByHospital = async (req, res) => {
  try {
    const { hospitalId } = req.params;

    const patients = await Patient.findAll({
      where: { 
        hospitalId,
        isDeleted: false  // Only show non-deleted patients
      },
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

// 🔍 Get a single patient by ID (excluding deleted ones)
exports.getPatientById = async (req, res) => {
  try {
    const { id } = req.params;
    const hospitalId = req.hospitalId;
    
    const whereClause = {
      id,
      isDeleted: false  // Only show non-deleted patients
    };
    
    // Filter by hospitalId if user is a hospital
    if (hospitalId) {
      whereClause.hospitalId = hospitalId;
    }

    const patient = await Patient.findOne({
      where: whereClause,
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
    const {
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
      familyHistoryOfCancer,
      breastLump,
      breastPain,
      changeInBreastAppearance,
      breastSkinChanges,
      nippleDischarge,
      nippleSymptoms,
      previousBreastScreening,
      previousBreastProceduresOrAbnormalReport
    } = req.body;
    const hospitalId = req.hospitalId;
    
    const whereClause = {
      id,
      isDeleted: false  // Only update non-deleted patients
    };
    
    // Filter by hospitalId if user is a hospital
    if (hospitalId) {
      whereClause.hospitalId = hospitalId;
    }

    const patient = await Patient.findOne({
      where: whereClause
    });
    
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
      email,
      familyHistoryOfCancer,
      breastLump,
      breastPain,
      changeInBreastAppearance,
      breastSkinChanges,
      nippleDischarge,
      nippleSymptoms,
      previousBreastScreening,
      previousBreastProceduresOrAbnormalReport
    });
    
    res.status(200).json(patient);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// 🗑️ Soft delete a patient (set isDeleted to true)
exports.deletePatient = async (req, res) => {
  try {
    const { id } = req.params;
    const hospitalId = req.hospitalId;
    
    const whereClause = {
      id,
      isDeleted: false  // Only delete non-deleted patients
    };
    
    // Filter by hospitalId if user is a hospital
    if (hospitalId) {
      whereClause.hospitalId = hospitalId;
    }

    const patient = await Patient.findOne({
      where: whereClause
    });
    
    if (!patient) return res.status(404).json({ error: '❌ Patient not found' });

    // Soft delete - set isDeleted to true instead of destroying the record
    await patient.update({ isDeleted: true });
    
    res.status(200).json({ message: '✅ Patient deleted successfully' });
  } catch (error) {
    console.error('❌ Error deleting patient:', error);
    res.status(500).json({ error: error.message });
  }
};

// 🔍 Search patients (excluding deleted ones)
exports.searchPatients = async (req, res) => {
  try {
    const { query, hospitalId: queryHospitalId } = req.query;
    const authHospitalId = req.hospitalId;
    
    // Use hospitalId from auth if user is a hospital, otherwise use query param
    const hospitalId = authHospitalId || queryHospitalId;
    
    const whereClause = { 
      isDeleted: false  // Only search non-deleted patients
    };
    
    // Add hospitalId filter if available
    if (hospitalId) {
      whereClause.hospitalId = hospitalId;
    }
    
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

// 📊 Get deleted patients (optional - for admin purposes)
exports.getDeletedPatients = async (req, res) => {
  try {
    const { hospitalId } = req.params;

    const deletedPatients = await Patient.findAll({
      where: { 
        hospitalId,
        isDeleted: true  // Only show deleted patients
      },
      include: [{ model: Hospital, as: 'hospital' }]
    });

    res.status(200).json(deletedPatients);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// 🔄 Restore a deleted patient (optional)
exports.restorePatient = async (req, res) => {
  try {
    const { id } = req.params;

    const patient = await Patient.findOne({
      where: {
        id,
        isDeleted: true  // Only restore deleted patients
      }
    });
    
    if (!patient) return res.status(404).json({ error: '❌ Deleted patient not found' });

    await patient.update({ isDeleted: false });
    
    res.status(200).json({ 
      message: '✅ Patient restored successfully',
      patient
    });
  } catch (error) {
    console.error('❌ Error restoring patient:', error);
    res.status(500).json({ error: error.message });
  }
};