# EduStreamPro - Enterprise E-Learning Platform

EduStreamPro is a cutting-edge, enterprise-grade e-learning platform built with NestJS (Backend) and Vue 3 (Frontend). It features advanced capabilities including quantum-resistant security, neural learning paths, immersive learning experiences, and blockchain-verified credentials.

## 🚀 Features

### Core Features
- JWT authentication with refresh token rotation
- Role-based access control (Student/Instructor/Admin)
- HLS video streaming with adaptive bitrate
- Resumable video uploads with chunking
- Real-time quiz system with WebSocket integration
- Course enrollment and progress tracking
- Video metadata extraction and processing

### Advanced Security
- Quantum-resistant handshake protocol using Kyber768
- Post-quantum signatures with Dilithium3
- WebAuthn integration for passwordless authentication
- Behavioral analysis (keystroke dynamics, mouse patterns)
- Multi-factor authentication via Web Bluetooth

### AI and Machine Learning
- Neural learning paths with TensorFlow.js
- Dynamic quiz difficulty adjustment
- Predictive progress modeling
- Content recommendations based on learning patterns
- Engagement analytics and learning style detection

### Immersive Learning
- WebXR-powered VR/AR environments
- 3D laboratory simulations with Three.js
- Holographic instructor projections
- Interactive virtual experiments
- Adaptive content rendering

### Blockchain Integration
- NFT-based credential system
- IPFS decentralized storage
- Smart contract verification
- Immutable learning records
- Decentralized transcript validation

## 🛠 Technology Stack

### Backend (NestJS)
- TypeScript
- Socket.IO for real-time features
- TensorFlow.js for neural processing
- IPFS/Web3.Storage for decentralized storage
- Post-quantum cryptography libraries

### Frontend (Vue 3)
- TypeScript
- Pinia for state management
- Three.js for 3D/WebGL
- WebXR API for VR/AR
- Socket.IO client

## 🏗 Architecture

The platform follows a modular, microservices-ready architecture:

```
backend/
├── src/
│   ├── auth/         # Authentication & security
│   ├── courses/      # Course management
│   ├── quizzes/      # Real-time quiz system
│   └── shared/       # Shared utilities
frontend/
├── src/
│   ├── components/   # Reusable Vue components
│   ├── views/        # Page components
│   ├── stores/       # Pinia state stores
│   └── services/     # API integration
```

## 🚦 Getting Started

### Prerequisites
- Node.js (v16+)
- npm or yarn
- Git

### Installation

1. Clone the repository:
```bash
git clone https://github.com/AbdelalimB1729/EduStreamPro.git
cd EduStreamPro
```

2. Install backend dependencies:
```bash
cd backend
npm install
```

3. Install frontend dependencies:
```bash
cd ../frontend
npm install
```

### Configuration

1. Backend environment variables:
```env
JWT_SECRET=your_jwt_secret
REFRESH_SECRET=your_refresh_secret
AWS_ACCESS_KEY_ID=your_aws_key
AWS_SECRET_ACCESS_KEY=your_aws_secret
AWS_REGION=your_aws_region
AWS_BUCKET_NAME=your_bucket_name
IPFS_HOST=your_ipfs_host
IPFS_PORT=5001
IPFS_PROTOCOL=https
WEB3_STORAGE_TOKEN=your_web3_token
ETH_RPC_URL=your_ethereum_rpc_url
ETH_PRIVATE_KEY=your_eth_private_key
CREDENTIAL_CONTRACT_ADDRESS=your_contract_address
```

2. Frontend environment variables:
```env
VITE_API_URL=http://localhost:3000
VITE_WS_URL=ws://localhost:3000
```

### Running the Application

1. Start the backend:
```bash
cd backend
npm run start:dev
```

2. Start the frontend:
```bash
cd frontend
npm run dev
```

## 🔒 Security Features

- Quantum-resistant cryptography for future-proof security
- Behavioral biometrics for continuous authentication
- Zero-knowledge proofs for credential verification
- Homomorphic encryption for secure video delivery
- Multi-layered access control system

## 🎓 Learning Features

- Adaptive learning paths based on neural networks
- Real-time progress tracking and analytics
- Interactive 3D/VR learning environments
- AI-powered content recommendations
- Blockchain-verified credentials and certificates

## 📈 Performance

- Lazy-loaded components and routes
- Adaptive bitrate streaming
- WebAssembly acceleration for complex computations
- Optimized WebGL rendering
- Efficient state management with Pinia

## 🤝 Contributing

Contributions are welcome! Please read our contributing guidelines and code of conduct.

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🙏 Acknowledgments

- NestJS team for the excellent backend framework
- Vue.js team for the powerful frontend framework
- TensorFlow.js team for machine learning capabilities
- Three.js team for 3D rendering features
- IPFS team for decentralized storage solutions