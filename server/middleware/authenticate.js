const User = require('../models/user');
const Session = require('../models/session');

const authenticate = async (req, res, next) => {
  try {
    const { token } = req.cookies;
    if (typeof token !== 'string') {
      throw new Error('Запрос файла cookie недействителен.');
    }
    const session = await Session.findOne({ token, status: 'valid' });
    if (!session) {
      res.clearCookie('token');
      throw new Error('Время сеанса истекло. Вам необходимо войти в систему.');
    }
    req.session = session;
    next();
  } catch (err) {
    res.status(401).json({
      errors: [
        {
          title: 'Unauthorized',
          detail: 'Учетные данные аутентификации недействительны',
          errorMessage: err.message,
        },
      ],
    });
  }
};

module.exports = { authenticate };
