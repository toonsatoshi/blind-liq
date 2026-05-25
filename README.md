# TonTation: The Volatility Rotation Protocol

**A Real-Time, Zero-Sum Volatility Settlement Engine on the TON Blockchain.**

TonTation is a novel, high-frequency volatility arena built on [The Open Network (TON)](https://ton.org/). It compresses leveraged trading mechanics into synchronized 60-second rounds, creating a multiplayer game of market pressure.

## 🌟 Overview

Unlike traditional derivatives, TonTation operates as a **zero-sum, peer-to-peer redistribution engine**. It maintains no directional market exposure, instead facilitating the redistribution of stakes between "Long" and "Short" players based on deterministic mathematical rules.

### Key Features
- **Instant Resolution:** Ultra-short 60-second rounds for continuous engagement.
- **Zero-Sum Economics:** Payouts derive exclusively from the opposing pool, ensuring protocol sustainability.
- **TON Native:** Built to leverage the high throughput of the TON blockchain and seamless Telegram integration.
- **Deterministic Settlement:** Transparent, math-driven outcomes without external liquidity providers.

## 🏗️ Architecture

The protocol utilizes a hybrid stack designed for sub-second precision and atomic settlement:

- **Frontend:** React/Vite application integrated with `@tonconnect/ui`.
- **Backend:** Authoritative round coordination using Cloudflare Workers and Durable Objects.
- **Smart Contracts:** On-chain settlement and custodial logic on the TON blockchain.
- **Oracle Pipeline:** Multi-source price aggregation (Binance, OKX) with consensus logic.

For a detailed breakdown, see the [Architecture Section in the Whitepaper](./WHITEPAPER.md#4-system-architecture).

## 🚀 Getting Started

### Prerequisites
- Node.js (v18+)
- pnpm or npm
- TON Wallet (e.g., Tonkeeper)

### Installation
1. Clone the repository:
   ```bash
   git clone https://github.com/toonsatoshi/TonTation.git
   cd TonTation
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the development server:
   ```bash
   npm run dev
   ```

## 🗺️ Roadmap

The project is currently in the prototype phase. Our execution plan is divided into three stages:

- **Days 0–30:** Contract repository setup, backend state machine skeleton, and frontend integration.
- **Days 31–60:** Oracle consensus implementation, testnet settlement integration, and ledger API.
- **Days 61–90:** Security audit, load testing, and mainnet readiness.

See the full [Development Guide](./DEVELOPMENT_GUIDE.md) for detailed tasks.

## 📄 Documentation

- [Whitepaper](./WHITEPAPER.md): Core protocol mechanics, mathematical foundation, and vision.
- [Development Guide](./DEVELOPMENT_GUIDE.md): Technical roadmap and implementation details.

## ⚖️ License

This project is licensed under the terms specified in the repository.
