var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');
const { Op } = require('sequelize');

const { Sequelize } = require('sequelize');
const sequelize = new Sequelize('sqlite::memory:')

const  {Account}  = require('./models/accounts');  // Importa el modelo Account
const  {Agreement}  = require('./models/aggreement');  // Importa el modelo Agreement

var indexRouter = require('./routes/index');
var usersRouter = require('./routes/users');
const { Submission } = require('./models/submissions');

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

app.get('/agreements', async (req, res) => {
    try {
      const accountId = req.query.accountId;  
  
      const agreements = await Agreement.findAll({
        where: {
          [Op.or]: [
            { BuyerId: accountId },
            { SupplierId: accountId }
          ],
          status: {
            [Op.ne]: 'terminated'
          }
        }
      });
  
      return res.json(agreements);
    } catch (error) {
      console.error('Error al obtener la lista de acuerdos:', error);
      return res.status(500).json({ error: 'Ocurrió un error al obtener la lista de acuerdos.' });
    }
  });
  
  //3. **_GET_** `/submissions/unpaid` - Get all unpaid submissions for a user (either a buyer or supplier) but only for active agreements.

  app.get('/submissions/unpaid', async (req, res) => {
    try {
      const accountId = req.query.accountId;
  
      const unpaidSubmissions = await Submission.findAll({
        include: [
          {
            model: Agreement,
            where: {
              [Op.or]: [
                { BuyerId: accountId },
                { SupplierId: accountId }
              ],
              status: {
                [Op.eq]: 'in_progress'
              }
            },
          }
        ],
        where: {
          paid: 0
        }
      });
  
      return res.json(unpaidSubmissions);
    } catch (error) {
      console.error('Error al obtener las prestaciones no pagadas:', error);
      return res.status(500).json({ error: 'Ocurrió un error al obtener las prestaciones no pagadas.' });
    }
  });
  
  //4. **_POST_** `/submissions/:submission_id/pay` - Implement this API to allow buyers to pay for a submission. A buyer can only pay if their balance is greater than or equal to the amount to pay. The amount should be moved from the buyer's balance to the supplier's balance.
  app.post('/submissions/:submission_id/pay', async (req, res) => {
    try {
      const submissionId = req.params.submission_id;
      const { buyerId } = req.body; 

      const submission = await Submission.findByPk(submissionId, {
        include: Agreement,
      });

      if (submission.Agreement.BuyerId !== buyerId) {
        return res.status(400).json({ error: 'La prestacion no pertenece al comprador. ' + submission.Agreement.BuyerId + " " + buyerId});
      }
      if (!submission) {
        return res.status(400).json({ error: 'La prestacion no existe ' });
      }
  
      const buyer = await Account.findByPk(buyerId);
      const supplier = await Account.findByPk(submission.Agreement.SupplierId);

      const submissionPrice = submission.price;
      if (buyer.balance < submissionPrice) {
        return res.status(400).json({ error: 'El comprador no tiene suficiente saldo para pagar.' });
      }

      buyer.balance -= submissionPrice;
      supplier.balance += submissionPrice;
      submission.paymentDate = new Date();
      submission.paid = 1;
      await buyer.save();
      await supplier.save();
      await submission.save();
  
      return res.json({ message: 'Pago exitoso. Saldo actualizado.' });
    } catch (error) {
      console.error('Error al procesar el pago:', error);
      return res.status(500).json({ error: 'Ocurrió un error al procesar el pago.' });
    }
  });

  //5. **_POST_** `/balances/deposit/:accountId` - Implement the API to allow buyers to deposit money into their balance. A buyer can't deposit more than 10% of their total submissions to pay at the moment of deposit.
  
  
module.exports = app;
