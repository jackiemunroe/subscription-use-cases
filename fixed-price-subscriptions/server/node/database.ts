import Stripe from "stripe";
import { sqlite3, Database } from "sqlite3";

const sqlite3: sqlite3 = require('sqlite3').verbose();
const stripe: Stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const DATABASE_NAME = 'stripe.sqlite3';
const TABLE_NAME = 'uid_to_customer';
const FXA_COLUMN = 'fxa_uid';
const CUSTOMER_COLUMN = 'customer_id';

type UserCustomer = {
  fxa_uid: string;
  customer_id: string;
};

var db: Database;

function initializeDatabase() {
  console.log('create database for Stripe Account connection');
  db = new sqlite3.Database(DATABASE_NAME, createTable);
  db.close();
}

function createTable() {
  console.log(`create ${TABLE_NAME} if it does not exist`)
  db.run(`CREATE TABLE IF NOT EXISTS ${TABLE_NAME} (${FXA_COLUMN} TEXT PRIMARY KEY, ${CUSTOMER_COLUMN} TEXT NOT NULL UNIQUE)`, insertRows);
}

async function insertRows() {
  const userCustomers = await loadCustomers();
  const insertValues = userCustomers.map(userCustomer => {`(${userCustomer.fxa_uid}, ${userCustomer.customer_id})`}).join(',');
  const insertQuery = `INSERT INTO ${TABLE_NAME} (${FXA_COLUMN}, ${CUSTOMER_COLUMN}) VALUES ${insertValues}`;

  db.run(insertQuery);
}

async function loadCustomers() {
  const limit = 100;

  let values: Array<UserCustomer> = [];
  let customerList = await stripe.customers.list({limit: limit});
  customerList.data.forEach(customer => {
    values.push({
      fxa_uid: customer.metadata.userid,
      customer_id: customer.id
    });
  });

  while (customerList.has_more) {
    const lastCustomer = customerList.data[customerList.data.length - 1].id;
    customerList = await stripe.customers.list(
      {
        limit:limit,
        starting_after: lastCustomer
      }
    );

    customerList.data.forEach(customer => {
      values.push({
        fxa_uid: customer.metadata.userid,
        customer_id: customer.id
      });
    });
  };

  return values;
}

function saveUserCustomer(userCustomer: UserCustomer) {
  db = new sqlite3.Database(DATABASE_NAME);
  db.run(`INSERT INTO ${TABLE_NAME} (${FXA_COLUMN}, ${CUSTOMER_COLUMN}) VALUES (${userCustomer.fxa_uid}, ${userCustomer.customer_id})`);
  db.close();
}

function findUserCustomerByUID(fxaUID: string) {
  db = new sqlite3.Database(DATABASE_NAME);

  let sql = `SELECT ${FXA_COLUMN}, ${CUSTOMER_COLUMN} FROM ${TABLE_NAME} WHERE ${FXA_COLUMN} = ${fxaUID}`; 
  db.get(sql, function(err, row) {
    if (row !== undefined) {
      return row;
    }
  });

  db.close();
}

function deleteUserCustomerByUID(fxaUID: string) {
  db = new sqlite3.Database(DATABASE_NAME);
  let sql = `DELETE FROM FROM ${TABLE_NAME} WHERE ${FXA_COLUMN} = ${fxaUID}`; 
  db.run(sql);
  db.close();
}