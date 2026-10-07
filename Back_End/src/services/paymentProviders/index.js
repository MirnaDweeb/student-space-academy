const MockPaymentProvider = require('./MockPaymentProvider');
const PaymobPaymentProvider = require('./PaymobPaymentProvider');

const providers = {
  DEVELOPMENT_MOCK: new MockPaymentProvider(),
  PAYMOB: new PaymobPaymentProvider(),
};

function getPaymentProvider(providerName) {
  const selected =
    providerName ||
    process.env.PAYMENT_PROVIDER ||
    (process.env.PAYMOB_API_KEY ? 'PAYMOB' : 'DEVELOPMENT_MOCK');
  if (providers[selected]) {
    return providers[selected];
  }
  // Default fallback to mock provider in dev/sandbox
  return providers.DEVELOPMENT_MOCK;
}

module.exports = {
  getPaymentProvider,
  MockPaymentProvider,
  PaymobPaymentProvider,
};
