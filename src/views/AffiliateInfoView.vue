<template>
  <div class="affiliate-info-page">
    <div class="hero-section">
      <div class="container">
        <div class="hero-content">
          <h1>💰 Join Our Affiliate Program</h1>
          <p class="lead">
            Earn money by promoting Vegvisr to your network. Get paid for every successful referral!
          </p>

          <div class="commission-highlight">
            <h2>Earn Up To 15% Commission</h2>
            <p>For every user you refer who becomes a subscriber</p>
          </div>

          <div class="cta-buttons">
            <RouterLink to="/affiliate/register" class="btn btn-primary btn-lg me-3">
              🚀 Start Earning Now
            </RouterLink>
            <RouterLink to="/affiliate" class="btn btn-outline-primary btn-lg">
              📊 View Dashboard
            </RouterLink>
          </div>
        </div>
      </div>
    </div>

    <div class="benefits-section">
      <div class="container">
        <h2 class="text-center mb-5">Why Join Our Affiliate Program?</h2>

        <div class="row">
          <div class="col-md-4 mb-4">
            <div class="benefit-card">
              <div class="benefit-icon">💰</div>
              <h3>High Commissions</h3>
              <p>
                Earn up to 15% commission on every successful referral. The more you refer, the more
                you earn!
              </p>
            </div>
          </div>

          <div class="col-md-4 mb-4">
            <div class="benefit-card">
              <div class="benefit-icon">📊</div>
              <h3>Real-time Tracking</h3>
              <p>
                Monitor your referrals, earnings, and performance with our comprehensive dashboard.
              </p>
            </div>
          </div>

          <div class="col-md-4 mb-4">
            <div class="benefit-card">
              <div class="benefit-icon">🎯</div>
              <h3>Easy Promotion</h3>
              <p>
                Get access to marketing materials, referral links, and invitation tools to boost
                your success.
              </p>
            </div>
          </div>
        </div>

        <div class="row">
          <div class="col-md-6 mb-4">
            <div class="benefit-card">
              <div class="benefit-icon">💳</div>
              <h3>Monthly Payouts</h3>
              <p>Receive your earnings monthly via PayPal. No minimum payout threshold!</p>
            </div>
          </div>

          <div class="col-md-6 mb-4">
            <div class="benefit-card">
              <div class="benefit-icon">🤝</div>
              <h3>Dedicated Support</h3>
              <p>
                Our affiliate team is here to help you succeed with tips, strategies, and personal
                support.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="how-it-works-section">
      <div class="container">
        <h2 class="text-center mb-5">How It Works</h2>

        <div class="steps">
          <div class="step">
            <div class="step-number">1</div>
            <div class="step-content">
              <h3>Sign Up</h3>
              <p>Register for our affiliate program in just a few clicks. It's completely free!</p>
            </div>
          </div>

          <div class="step">
            <div class="step-number">2</div>
            <div class="step-content">
              <h3>Share Your Link</h3>
              <p>
                Get your unique referral link and share it with your network through social media,
                email, or your website.
              </p>
            </div>
          </div>

          <div class="step">
            <div class="step-number">3</div>
            <div class="step-content">
              <h3>Earn Commissions</h3>
              <p>
                When someone signs up through your link and becomes a subscriber, you earn a
                commission!
              </p>
            </div>
          </div>

          <div class="step">
            <div class="step-number">4</div>
            <div class="step-content">
              <h3>Get Paid</h3>
              <p>Receive your earnings monthly via PayPal. Track everything in your dashboard.</p>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="cta-section">
      <div class="container text-center">
        <h2>Ready to Start Earning?</h2>
        <p class="lead mb-4">
          Join hundreds of successful affiliates who are already earning with us!
        </p>

        <RouterLink to="/affiliate/register" class="btn btn-success btn-lg">
          💰 Join Affiliate Program
        </RouterLink>

        <div class="existing-affiliate mt-4">
          <p>
            Already an affiliate?
            <RouterLink to="/affiliate" class="text-primary"> Access your dashboard → </RouterLink>
          </p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { RouterLink } from 'vue-router'
</script>

<style scoped>
.affiliate-info-page {
  font-family: 'Arial', sans-serif;
}

.hero-section {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  padding: 80px 0;
  text-align: center;
}

.hero-content h1 {
  font-size: 3rem;
  font-weight: bold;
  margin-bottom: 1rem;
}

.lead {
  font-size: 1.5rem;
  margin-bottom: 2rem;
  opacity: 0.9;
}

.commission-highlight {
  background: rgba(255, 255, 255, 0.1);
  padding: 2rem;
  border-radius: 15px;
  margin: 2rem 0;
  backdrop-filter: blur(10px);
}

.commission-highlight h2 {
  font-size: 2.5rem;
  margin-bottom: 0.5rem;
  color: #ffd700;
}

.cta-buttons {
  margin-top: 2rem;
}

.benefits-section {
  padding: 80px 0;
  background: #f8f9fa;
}

.benefit-card {
  background: white;
  padding: 2rem;
  border-radius: 15px;
  text-align: center;
  box-shadow: 0 5px 15px rgba(0, 0, 0, 0.1);
  height: 100%;
  transition: transform 0.3s ease;
}

.benefit-card:hover {
  transform: translateY(-5px);
}

.benefit-icon {
  font-size: 3rem;
  margin-bottom: 1rem;
}

.benefit-card h3 {
  color: #333;
  margin-bottom: 1rem;
}

.how-it-works-section {
  padding: 80px 0;
  background: white;
}

.steps {
  display: flex;
  flex-direction: column;
  gap: 2rem;
  max-width: 800px;
  margin: 0 auto;
}

.step {
  display: flex;
  align-items: center;
  gap: 2rem;
  padding: 2rem;
  background: #f8f9fa;
  border-radius: 15px;
  box-shadow: 0 3px 10px rgba(0, 0, 0, 0.1);
}

.step-number {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  width: 60px;
  height: 60px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.5rem;
  font-weight: bold;
  flex-shrink: 0;
}

.step-content h3 {
  margin-bottom: 0.5rem;
  color: #333;
}

.cta-section {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  padding: 80px 0;
}

.cta-section h2 {
  font-size: 2.5rem;
  margin-bottom: 1rem;
}

.existing-affiliate {
  color: rgba(255, 255, 255, 0.8);
}

.existing-affiliate a {
  color: #ffd700;
  text-decoration: none;
}

.existing-affiliate a:hover {
  text-decoration: underline;
}

@media (max-width: 768px) {
  .hero-content h1 {
    font-size: 2rem;
  }

  .lead {
    font-size: 1.2rem;
  }

  .commission-highlight h2 {
    font-size: 2rem;
  }

  .step {
    flex-direction: column;
    text-align: center;
  }

  .cta-buttons {
    flex-direction: column;
    gap: 1rem;
  }

  .btn-lg {
    width: 100%;
  }
}
</style>
