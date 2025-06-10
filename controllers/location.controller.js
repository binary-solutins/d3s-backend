const { Country, State, City } = require('../models');
const { Op } = require('sequelize');

const locationController = {
  // Get all countries for dropdown
  getAllCountries: async (req, res) => {
    try {
      const countries = await Country.findAll({
        attributes: [
          ['id', 'id'],
          ['name', 'name'],
          ['shortname', 'isoCode'],
          ['phonecode', 'phoneCode']
        ],
        order: [['name', 'ASC']]
      });

      return res.status(200).json({
        success: true,
        data: countries
      });
    } catch (error) {
      console.error('Error fetching countries:', error);
      return res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  },

  // Get states by country ID
  getStatesByCountry: async (req, res) => {
    try {
      const { countryId } = req.params;

      // Validate countryId
      if (!countryId || isNaN(countryId)) {
        return res.status(400).json({
          success: false,
          message: 'Valid country ID is required'
        });
      }

      // Check if country exists
      const country = await Country.findOne({
        where: {
          id: parseInt(countryId)
        }
      });

      if (!country) {
        return res.status(404).json({
          success: false,
          message: 'Country not found'
        });
      }

      // Get states for the specific country
      const states = await State.findAll({
        attributes: [
          ['id', 'id'],
          ['name', 'name']
        ],
        where: {
          country_id: parseInt(countryId)
        },
        order: [['name', 'ASC']]
      });

      return res.status(200).json({
        success: true,
        data: states
      });
    } catch (error) {
      console.error('Error fetching states:', error);
      return res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  },

  // Get cities by state ID
  getCitiesByState: async (req, res) => {
    try {
      const { stateId } = req.params;

      // Validate stateId
      if (!stateId || isNaN(stateId)) {
        return res.status(400).json({
          success: false,
          message: 'Valid state ID is required'
        });
      }

      // Check if state exists
      const state = await State.findOne({
        where: {
          id: parseInt(stateId)
        }
      });

      if (!state) {
        return res.status(404).json({
          success: false,
          message: 'State not found'
        });
      }

      // Get cities for the specific state
      const cities = await City.findAll({
        attributes: [
          ['id', 'id'],
          ['name', 'name']
        ],
        where: {
          state_id: parseInt(stateId)
        },
        order: [['name', 'ASC']]
      });

      return res.status(200).json({
        success: true,
        data: cities
      });
    } catch (error) {
      console.error('Error fetching cities:', error);
      return res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  },

  // Optional: Get country with states and cities (for testing)
  getCountryWithLocations: async (req, res) => {
    try {
      const { countryId } = req.params;

      const country = await Country.findOne({
        where: {
          id: parseInt(countryId)
        },
        include: [
          {
            model: State,
            as: 'states',
            required: false,
            include: [
              {
                model: City,
                as: 'cities',
                required: false
              }
            ]
          }
        ]
      });

      if (!country) {
        return res.status(404).json({
          success: false,
          message: 'Country not found'
        });
      }

      return res.status(200).json({
        success: true,
        data: country
      });
    } catch (error) {
      console.error('Error fetching country with locations:', error);
      return res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  }
};

module.exports = locationController;