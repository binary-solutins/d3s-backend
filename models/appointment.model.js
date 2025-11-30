module.exports = (sequelize, DataTypes) => {
    const Appointment = sequelize.define('Appointment', {
        name: {
            type: DataTypes.STRING,
            allowNull: false,
            validate: {
                notEmpty: true,
                len: [2, 100]
            }
        },
        email: {
            type: DataTypes.STRING,
            allowNull: false,
            validate: {
                isEmail: true,
                notEmpty: true
            }
        },
        phone: {
            type: DataTypes.STRING,
            allowNull: false,
            validate: {
                notEmpty: true,
                len: [10, 15]
            }
        },
        service: {
            type: DataTypes.ENUM('breast-scan', 'ecg', 'comprehensive'),
            allowNull: false,
            validate: {
                notEmpty: true
            }
        },
        date: {
            type: DataTypes.DATEONLY,
            allowNull: false,
            validate: {
                isDate: true,
                isAfter: new Date().toISOString().split('T')[0] // Must be today or future
            }
        },
        time: {
            type: DataTypes.ENUM('morning', 'afternoon', 'evening'),
            allowNull: false,
            validate: {
                notEmpty: true
            }
        },
        address: {
            type: DataTypes.TEXT,
            allowNull: false,
            validate: {
                notEmpty: true,
                len: [10, 500]
            }
        },
        notes: {
            type: DataTypes.TEXT,
            allowNull: true,
            validate: {
                len: [0, 1000]
            }
        },
        status: {
            type: DataTypes.ENUM('pending', 'confirmed', 'completed', 'cancelled'),
            allowNull: false,
            defaultValue: 'pending'
        },
        // Computed fields for easier querying
        serviceName: {
            type: DataTypes.VIRTUAL,
            get() {
                const serviceMap = {
                    'breast-scan': 'Breast Screening @ Home',
                    'ecg': 'ECG @ Home',
                    'comprehensive': 'Comprehensive (Breast + ECG)'
                };
                return serviceMap[this.service] || this.service;
            }
        },
        servicePrice: {
            type: DataTypes.VIRTUAL,
            get() {
                const priceMap = {
                    'breast-scan': 299,
                    'ecg': 249,
                    'comprehensive': 449
                };
                return priceMap[this.service] || 0;
            }
        },
        timeSlot: {
            type: DataTypes.VIRTUAL,
            get() {
                const timeMap = {
                    'morning': 'Morning (8AM - 12PM)',
                    'afternoon': 'Afternoon (12PM - 5PM)',
                    'evening': 'Evening (5PM - 8PM)'
                };
                return timeMap[this.time] || this.time;
            }
        },
        statusBadge: {
            type: DataTypes.VIRTUAL,
            get() {
                const statusMap = {
                    'pending': '⏳ Pending',
                    'confirmed': '✅ Confirmed',
                    'completed': '🎉 Completed',
                    'cancelled': '❌ Cancelled'
                };
                return statusMap[this.status] || this.status;
            }
        }
    }, {
        // Model options
        timestamps: true,
        indexes: [
            {
                fields: ['date', 'time']
            },
            {
                fields: ['email']
            },
            {
                fields: ['phone']
            },
            {
                fields: ['status']
            },
            {
                fields: ['service']
            }
        ],
        // Hooks
        hooks: {
            beforeValidate: (appointment) => {
                // Trim whitespace from string fields
                if (appointment.name) appointment.name = appointment.name.trim();
                if (appointment.email) appointment.email = appointment.email.trim().toLowerCase();
                if (appointment.phone) appointment.phone = appointment.phone.trim();
                if (appointment.address) appointment.address = appointment.address.trim();
                if (appointment.notes) appointment.notes = appointment.notes.trim();
            }
        }
    });

    // Instance methods
    Appointment.prototype.toJSON = function () {
        const values = Object.assign({}, this.get());

        // Add computed fields to JSON output
        values.serviceName = this.serviceName;
        values.servicePrice = this.servicePrice;
        values.timeSlot = this.timeSlot;
        values.statusBadge = this.statusBadge;

        return values;
    };

    // Class methods
    Appointment.getServicePricing = function () {
        return {
            'breast-scan': { name: 'Breast Screening @ Home', price: 299 },
            'ecg': { name: 'ECG @ Home', price: 249 },
            'comprehensive': { name: 'Comprehensive (Breast + ECG)', price: 449 }
        };
    };

    Appointment.getTimeSlots = function () {
        return {
            'morning': 'Morning (8AM - 12PM)',
            'afternoon': 'Afternoon (12PM - 5PM)',
            'evening': 'Evening (5PM - 8PM)'
        };
    };

    Appointment.getStatusOptions = function () {
        return ['pending', 'confirmed', 'completed', 'cancelled'];
    };


    return Appointment;
};