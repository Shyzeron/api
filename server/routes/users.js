const express = require('express');
const bcrypt = require('bcryptjs');

const User = require('../models/user');
const Session = require('../models/session');
const { authenticate } = require('../middleware/authenticate');
const { csrfCheck } = require('../middleware/csrfCheck');
const { initSession, isEmail } = require('../utils/utils');

const router = express.Router();

router.post('/register', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!isEmail(email)) {
      throw new Error('Электронная почта должна быть действительным адресом электронной почты.');
    }
    if (typeof password !== 'string') {
      throw new Error('Пароль должен быть строкой.');
    }
    const user = new User({ email, password });
    const persistedUser = await user.save();
    const userId = persistedUser._id;

    const session = await initSession(userId);

    res
      .cookie('token', session.token, {
        httpOnly: true,
        sameSite: true,
        maxAge: 1209600000,
        secure: process.env.NODE_ENV === 'production',
      })
      .status(201)
      .json({
        title: 'User Registration Successful',
        detail: 'Успешно зарегистрирован новый пользователь',
        csrfToken: session.csrfToken,
      });
  } catch (err) {
    res.status(400).json({
      errors: [
        {
          title: 'Registration Error',
          detail: 'Что-то пошло не так в процессе регистрации.',
          errorMessage: err.message,
        },
      ],
    });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!isEmail(email)) {
      return res.status(400).json({
        errors: [
          {
            title: 'Bad Request',
            detail: 'EMAIL быть действительным адресом электронной почты.',
          },
        ],
      });
    }
    if (typeof password !== 'string') {
      return res.status(400).json({
        errors: [
          {
            title: 'Bad Request',
            detail: 'Пароль должен быть строкой',
          },
        ],
      });
    }
    const user = await User.findOne({ email });
    if (!user) {
      throw new Error();
    }
    const userId = user._id;

    const passwordValidated = await bcrypt.compare(password, user.password);
    if (!passwordValidated) {
      throw new Error();
    }

    const session = await initSession(userId);

    res
      .cookie('token', session.token, {
        httpOnly: true,
        sameSite: true,
        maxAge: 1209600000,
        secure: process.env.NODE_ENV === 'production',
      })
      .json({
        title: 'Login Successful',
        detail: 'Учетные данные пользователя успешно проверены.',
        csrfToken: session.csrfToken,
      });
  } catch (err) {
    res.status(401).json({
      errors: [
        {
          title: 'Invalid Credentials',
          detail: 'Проверьте электронную почту и комбинацию пароля',
          errorMessage: err.message,
        },
      ],
    });
  }
});

router.get('/me', authenticate, async (req, res) => {
  try {
    const { userId } = req.session;
    const user = await User.findById({ _id: userId }, { email: 1, _id: 0 });

    res.json({
      title: 'Authentication successful',
      detail: 'Пользователь успешно авторизован',
      user,
    });
  } catch (err) {
    res.status(401).json({
      errors: [
        {
          title: 'Unauthorized',
          detail: 'Не авторизован для доступа к этому маршруту',
          errorMessage: err.message,
        },
      ],
    });
  }
});

router.delete('/me', authenticate, csrfCheck, async (req, res) => {
  try {
    const { userId } = req.session;
    const { password } = req.body;
    if (typeof password !== 'string') {
      throw new Error();
    }
    const user = await User.findById({ _id: userId });

    const passwordValidated = await bcrypt.compare(password, user.password);
    if (!passwordValidated) {
      throw new Error();
    }

    await Session.expireAllTokensForUser(userId);
    res.clearCookie('token');
    await User.findByIdAndDelete({ _id: userId });
    res.json({
      title: 'Account Deleted',
      detail: 'Аккаунт с предоставленными учетными данными был успешно удален.',
    });
  } catch (err) {
    res.status(401).json({
      errors: [
        {
          title: 'Invalid Credentials',
          detail: 'Проверьте электронную почту и комбинацию пароля',
          errorMessage: err.message,
        },
      ],
    });
  }
});

router.put('/logout', authenticate, csrfCheck, async (req, res) => {
  try {
    const { session } = req;
    await session.expireToken(session.token);
    res.clearCookie('token');

    res.json({
      title: 'Logout Successful',
      detail: 'Сеанс входа в систему успешно завершен.',
    });
  } catch (err) {
    res.status(400).json({
      errors: [
        {
          title: 'Logout Failed',
          detail: 'Что-то пошло не так во время процесса выхода из системы.',
          errorMessage: err.message,
        },
      ],
    });
  }
});

module.exports = router;
