const MockPaymentProvider = require('./MockPaymentProvider');
const StripePaymentProvider = require('./StripePaymentProvider');

const providers = {
  DEVELOPMENT_MOCK: new MockPaymentProvider(),
  STRIPE: new StripePaymentProvider(),
};

function getPaymentProvider(providerName) {
  const selected = providerName || process.env.PAYMENT_PROVIDER || (process.env.STRIPE_SECRET_KEY ? 'STRIPE' : 'DEVELOPMENT_MOCK');
  if (providers[selected]) {
    return providers[selected];
  }
  // Default fallback to mock provider in dev/sandbox
  return providers.DEVELOPMENT_MOCK;
}

module.exports = {
  getPaymentProvider,
  MockPaymentProvider,
  StripePaymentProvider,
};
