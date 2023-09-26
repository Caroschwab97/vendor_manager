var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');

const { Sequelize } = require('sequelize');
const sequelize = new Sequelize('sqlite::memory:')

const  {Account}  = require('./models/accounts');  // Importa el modelo Account
const  {Agreement}  = require('./models/aggreement');  // Importa el modelo Agreement

var indexRouter = require('./routes/index');
var usersRouter = require('./routes/users');

var app = express();

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/', indexRouter);
app.use('/users', usersRouter);

const PORT = process.env.PORT || 3001;  
const HOST = '0.0.0.0';  


app.listen(PORT, HOST, () => {
  console.log(`El servidor está en ejecución en http://${HOST}:${PORT}/`);
});

//**_GET_** `/agreements/:id` - Create an endpoint that return the agreement only if it belongs to the calling account.
app.get('/agreements/:id', async (req, res) => {
    const accountId = req.query.accountId;  
    const agreementId = req.params.id;  
  
    try {
      
      const agreement = await Agreement.findOne({
        where: { id: agreementId },
        include: [
          {
            model: Account,
            as: 'Buyer',
          },
          {
            model: Account,
            as: 'Supplier',
          },
        ],
      });
  
      if (!agreement) {
        return res.status(404).json({ error: 'Acuerdo no encontrado.' });
      }
  
      
      if (agreement.Buyer.id !== accountId && agreement.Supplier.id !== accountId) {
        return res.status(403).json({ error: 'Acceso denegado. Este acuerdo no pertenece a tu cuenta.' });
      }
  
    
      return res.json(agreement);
    } catch (error) {
      console.error('Error al obtener el acuerdo:', error);
      return res.status(500).json({ error: 'Ocurrió un error al obtener el acuerdo.' });
    }
  });

//2. **_GET_** `/agreements` - Return a list of agreements belonging to the user (buyer or supplier) where the agreements are not terminated.

module.exports = app;
