const db = require('../models');

exports.getAllCountries = async (req, res) => {
  try {
    const countries = await db.Country.findAll({
      attributes: ['id', 'name', 'isoCode'],
      order: [['name', 'ASC']]
    });
    res.json({ success: true, data: countries });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch countries',
      error: error.message 
    });
  }
};

exports.getStatesByCountry = async (req, res) => {
  try {
    const states = await db.State.findAll({
      where: { countryId: req.params.countryId },
      attributes: ['id', 'name', 'stateCode'],
      order: [['name', 'ASC']],
      include: [{
        model: db.Country,
        as: 'country',
        attributes: []
      }]
    });
    
    res.json({ 
      success: true, 
      data: states.length ? states : []
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch states',
      error: error.message 
    });
  }
};

exports.getCitiesByState = async (req, res) => {
  try {
    const cities = await db.City.findAll({
      where: { stateId: req.params.stateId },
      attributes: ['id', 'name'],
      order: [['name', 'ASC']],
      include: [{
        model: db.State,
        as: 'state',
        attributes: []
      }]
    });
    
    res.json({ 
      success: true, 
      data: cities.length ? cities : []
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch cities',
      error: error.message 
    });
  }
};