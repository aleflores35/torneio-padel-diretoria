// backend/services/categoriesService.js
const db = require('../database');

const categoriesService = {
  // Obter todas as categorias
  getAllCategories: (callback) => {
    db.getCategories((err, categories) => {
      if (err) return callback(err);
      callback(null, categories || []);
    });
  },

  // Obter categoria com status do torneio
  getCategoryWithStatus: (categoryId, callback) => {
    db.getCategoryById(categoryId, (err, category) => {
      if (err) return callback(err);
      if (!category) return callback(null, null);

      db.getTournamentMeta(categoryId, (err2, meta) => {
        if (err2) return callback(err2);
        callback(null, {
          ...category,
          tournament: meta || {
            registration_open: false,
            status: 'NOT_CONFIGURED'
          }
        });
      });
    });
  },

  // Criar categoria
  createCategory: (name, description, callback) => {
    // Validar
    if (!name || name.trim().length === 0) {
      return callback(new Error('Category name is required'));
    }

    db.createCategory(name.trim(), description || '', (err) => {
      if (err) return callback(err);
      callback(null, { name, description });
    });
  },

  // Abrir inscrições para categoria
  openRegistration: (categoryId, deadline, callback) => {
    if (!deadline || new Date(deadline) < new Date()) {
      return callback(new Error('Deadline must be in the future'));
    }

    db.getTournamentMeta(categoryId, (err, existing) => {
      if (err) return callback(err);

      if (existing) {
        db.updateTournamentMeta(categoryId, {
          registration_open: true,
          registration_deadline: deadline,
          status: 'REGISTRATION'
        }, callback);
      } else {
        db.run(
          `INSERT INTO tournament_meta (category_id, registration_open, registration_deadline, status)
           VALUES (?, ?, ?, ?)`,
          [categoryId, true, deadline, 'REGISTRATION'],
          callback
        );
      }
    });
  },

  // Fechar inscrições
  closeRegistration: (categoryId, callback) => {
    db.updateTournamentMeta(categoryId, {
      registration_open: false,
      status: 'RUNNING'
    }, callback);
  },

  // Checar se inscrições estão abertas
  isRegistrationOpen: (categoryId, callback) => {
    db.getTournamentMeta(categoryId, (err, meta) => {
      if (err) return callback(err);
      if (!meta) return callback(null, false);

      const now = new Date();
      const isOpen = meta.registration_open &&
                     new Date(meta.registration_deadline) > now;
      callback(null, isOpen);
    });
  },

  // Obter status de uma fase
  getPhaseStatus: (phaseId, callback) => {
    db.get('SELECT * FROM tournament_phases WHERE id = ?', [phaseId], callback);
  }
};

module.exports = categoriesService;
