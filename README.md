# VirusTotal ZIP Scanner

<div align="center">

![VirusTotal ZIP Scanner](public/shield.svg)

**A secure, intelligent web application for scanning ZIP file contents with VirusTotal**

[![Built with React](https://img.shields.io/badge/Built%20with-React%2019-61dafb?logo=react)](https://reactjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-blue?logo=typescript)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-6.3-646cff?logo=vite)](https://vitejs.dev/)
[![TailwindCSS](https://img.shields.io/badge/TailwindCSS-3.4-38bdf8?logo=tailwindcss)](https://tailwindcss.com/)

</div>

## 🛡️ Overview

VirusTotal ZIP Scanner is a sophisticated web application that provides secure analysis of ZIP file contents using the VirusTotal API. It features advanced security measures, intelligent duplicate detection, comprehensive rate limiting, and a modern, responsive user interface.

### ✨ Key Features

- **🔒 Enhanced Security**: Advanced ZIP bomb detection, path traversal protection, and malicious file pattern analysis
- **🧠 Smart Duplicate Detection**: SHA-256 based file deduplication to save API quota and processing time
- **⚡ Intelligent Rate Limiting**: Sophisticated rate limiting system respecting VirusTotal's API constraints
- **📊 Comprehensive History**: Persistent scan history with advanced filtering and bulk operations
- **🎨 Modern UI**: Clean, responsive interface with light/dark/system theme support
- **💾 Offline Persistence**: IndexedDB-based storage for queue state and scan history
- **🔄 Background Processing**: Asynchronous scanning with real-time progress tracking
- **📱 Mobile Responsive**: Optimized for desktop, tablet, and mobile devices

## 🚀 Quick Start

### Prerequisites

- **Node.js** 18.0 or higher
- **npm** 9.0 or higher
- **VirusTotal API Key** (free tier available)

### Installation

1. **Clone the repository**

   ```bash
   git clone https://github.com/N3vvb1e/vt-zip-scanner.git
   cd vt-zip-scanner
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Configure environment**

   ```bash
   # Create .env file
   echo "VITE_VT_API_KEY=your_virustotal_api_key_here" > .env
   ```

4. **Start development server**

   ```bash
   npm run dev
   ```

5. **Open in browser**
   ```
   http://localhost:5173
   ```

### Getting a VirusTotal API Key

1. Visit [VirusTotal.com](https://www.virustotal.com/gui/join-us)
2. Create a free account
3. Navigate to your profile settings
4. Copy your API key
5. Add it to your `.env` file

## 🏗️ Architecture

### Technology Stack

- **Frontend Framework**: React 19 with TypeScript
- **Build Tool**: Vite 6.3
- **Styling**: TailwindCSS with custom design system
- **UI Components**: Radix UI primitives with custom styling
- **Animations**: Framer Motion for smooth transitions
- **Icons**: Lucide React icon library
- **Database**: IndexedDB for client-side persistence
- **HTTP Client**: Axios with custom error handling

### Project Structure

```
src/
├── components/          # React components
│   ├── scanner/        # Core scanning components
│   └── ui/             # Reusable UI components
├── contexts/           # React contexts (Theme, etc.)
├── hooks/              # Custom React hooks
├── services/           # Business logic and API services
│   ├── database/       # IndexedDB management
│   └── repositories/   # Data access layer
├── types/              # TypeScript type definitions
├── utils/              # Utility functions
│   └── zip/           # ZIP processing utilities
└── config/            # Configuration constants
```

### Core Systems

#### 1. Security System

- **ZIP Bomb Detection**: Analyzes compression ratios and file sizes
- **Path Traversal Protection**: Validates file paths and prevents directory escapes
- **Malicious Pattern Detection**: Identifies suspicious file types and structures
- **Size Limits**: Enforces maximum file and archive size constraints

#### 2. Duplicate Detection

- **SHA-256 Hashing**: Calculates cryptographic hashes for file identification
- **History Matching**: Compares against previously scanned files
- **API Quota Optimization**: Reuses existing scan results to save API calls
- **Cache Management**: Intelligent cleanup of old scan data

#### 3. Rate Limiting

- **VirusTotal Compliance**: Respects 4 requests/minute and 500 requests/day limits
- **Intelligent Spacing**: 18-second minimum intervals between requests
- **Queue Management**: Processes files in optimal batches
- **Real-time Monitoring**: Live API quota tracking and visualization

#### 4. Persistence Layer

- **IndexedDB Storage**: Client-side database for offline functionality
- **Repository Pattern**: Clean separation of data access logic
- **Transaction Management**: ACID-compliant database operations
- **Automatic Cleanup**: Configurable retention policies for old data

## 🔧 Configuration

### Environment Variables

| Variable          | Description        | Default | Required |
| ----------------- | ------------------ | ------- | -------- |
| `VITE_VT_API_KEY` | VirusTotal API key | -       | ✅       |

### Security Limits

The application enforces the following security constraints:

```typescript
const SECURITY_LIMITS = {
  MAX_ZIP_SIZE: 100 * 1024 * 1024, // 100 MB
  MAX_UNCOMPRESSED_SIZE: 500 * 1024 * 1024, // 500 MB
  MAX_FILE_COUNT: 1000, // files per ZIP
  MAX_EXTRACTION_DEPTH: 3, // nested ZIP levels
  MAX_PATH_LENGTH: 255, // characters
  MAX_SINGLE_FILE_SIZE: 50 * 1024 * 1024, // 50 MB
  MAX_COMPRESSION_RATIO: 100, // individual files
  MAX_OVERALL_COMPRESSION_RATIO: 50, // entire archive
};
```

### Rate Limiting Configuration

```typescript
const RATE_LIMIT_CONFIG = {
  REQUEST_LIMIT: 4, // requests per window
  REQUEST_WINDOW: 60 * 1000, // 60 seconds
  MIN_REQUEST_SPACING: 18000, // 18 seconds between requests
  POLL_INTERVAL: 20000, // 20 seconds
  BATCH_SUBMIT_DELAY: 2000, // 2 seconds
};
```

## 📖 Usage Guide

### Basic Workflow

1. **Upload ZIP File**: Drag and drop or click to select a ZIP file
2. **Security Analysis**: Automatic security scan with detailed report
3. **File Extraction**: Safe extraction of ZIP contents
4. **Queue Processing**: Files added to scanning queue
5. **VirusTotal Scanning**: Automated submission and result retrieval
6. **Results Review**: Comprehensive scan results with threat analysis

### Advanced Features

#### Duplicate Detection

- Files are automatically checked against scan history
- Duplicate files reuse existing results (marked as "reused")
- Saves API quota and reduces processing time
- SHA-256 + file size matching for accuracy

#### History Management

- **View Modes**: All files or unique files only
- **Filtering**: By scan status, file type, or threat level
- **Bulk Operations**: Select and download multiple safe files
- **Search**: Find specific files by name or hash
- **Cleanup**: Automatic removal of old scan data

#### Theme Support

- **Light Theme**: Clean, professional appearance
- **Dark Theme**: Reduced eye strain for extended use
- **System Theme**: Automatically follows OS preference
- **Persistent**: Theme choice saved across sessions

### Security Features

#### ZIP Security Analysis

Before extraction, each ZIP file undergoes comprehensive security analysis:

- **Compression Ratio Analysis**: Detects potential ZIP bombs
- **Path Validation**: Prevents directory traversal attacks
- **File Type Scanning**: Identifies suspicious file extensions
- **Size Validation**: Enforces reasonable file and archive limits
- **Nested Archive Detection**: Limits extraction depth

#### Safe File Handling

- Files are processed in isolated contexts
- No automatic execution of extracted content
- Malicious files are clearly marked and download-protected
- Secure blob storage for file data

## 🛠️ Development

### Available Scripts

```bash
# Development
npm run dev          # Start development server
npm run build        # Build for production
npm run preview      # Preview production build

# Code Quality
npm run lint         # Run ESLint
npm run type-check   # Run TypeScript compiler
```

### Development Setup

1. **Install dependencies**

   ```bash
   npm install
   ```

2. **Set up environment**

   ```bash
   cp .env.example .env
   # Edit .env with your VirusTotal API key
   ```

3. **Start development server**
   ```bash
   npm run dev
   ```

### Code Style

The project uses:

- **ESLint** for code linting
- **TypeScript** for type safety
- **Prettier** for code formatting (via ESLint)
- **Conventional Commits** for commit messages

## 🔒 Security Considerations

### ZIP File Security

- **ZIP Bomb Protection**: Analyzes compression ratios and file counts
- **Path Traversal Prevention**: Validates all file paths before extraction
- **File Type Validation**: Blocks dangerous file extensions
- **Size Limits**: Enforces maximum file and archive sizes

### API Security

- **Key Protection**: API keys stored securely in environment variables
- **Rate Limiting**: Strict adherence to VirusTotal API limits
- **Error Handling**: Graceful handling of API errors and timeouts

### Data Privacy

- **Local Storage**: All data stored locally in browser
- **No Server**: No backend server reduces attack surface
- **Temporary Files**: File data cleared after processing

## 🚀 Deployment

### Production Build

```bash
# Build for production
npm run build

# Preview production build locally
npm run preview
```

### Static Hosting

The application can be deployed to any static hosting service:

- **Vercel**: `vercel --prod`
- **Netlify**: Drag and drop `dist` folder
- **GitHub Pages**: Use GitHub Actions workflow
- **AWS S3**: Upload `dist` folder to S3 bucket

### Environment Configuration

For production deployment:

1. Set `VITE_VT_API_KEY` in your hosting platform's environment variables
2. Ensure HTTPS is enabled (required for VirusTotal API)
3. Configure appropriate CSP headers for security

## 📊 Performance

### Optimization Features

- **Code Splitting**: Automatic route-based code splitting
- **Tree Shaking**: Unused code elimination
- **Asset Optimization**: Automatic image and asset optimization
- **Lazy Loading**: Components loaded on demand
- **Caching**: Intelligent browser caching strategies

### Bundle Analysis

```bash
# Analyze bundle size
npm run build
npx vite-bundle-analyzer dist
```

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

### Development Process

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Add tests for new functionality
5. Ensure all tests pass (`npm test`)
6. Commit your changes (`git commit -m 'Add amazing feature'`)
7. Push to the branch (`git push origin feature/amazing-feature`)
8. Open a Pull Request

### Code of Conduct

This project adheres to the [Contributor Covenant Code of Conduct](CODE_OF_CONDUCT.md).

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **VirusTotal** for providing the comprehensive malware scanning API
- **React Team** for the excellent frontend framework
- **Vite Team** for the lightning-fast build tool
- **Tailwind CSS** for the utility-first CSS framework
- **Radix UI** for accessible component primitives
- **Lucide** for the beautiful icon library

## 📞 Support

- **Issues**: [GitHub Issues](https://github.com/N3vvb1e/vt-zip-scanner/issues)
- **Discussions**: [GitHub Discussions](https://github.com/N3vvb1e/vt-zip-scanner/discussions)

## 🔍 API Reference

### VirusTotal Integration

The application integrates with VirusTotal API v3:

#### Endpoints Used

- `POST /files` - Submit files for scanning
- `GET /analyses/{id}` - Retrieve scan results
- `GET /user` - Validate API key (optional)

#### Rate Limits

- **Public API**: 4 requests per minute, 500 per day
- **Premium API**: Higher limits (automatically detected)

#### Response Handling

- **Queued**: Scan submitted, waiting for results
- **Completed**: Scan finished, results available
- **Error**: API error or timeout occurred

### File Processing Pipeline

1. **Upload & Validation**

   - File type validation (ZIP only)
   - Size limit enforcement (100MB max)
   - MIME type verification

2. **Security Analysis**

   - ZIP bomb detection
   - Path traversal checks
   - Compression ratio analysis
   - File count validation

3. **Extraction & Hashing**

   - Safe file extraction
   - SHA-256 hash calculation
   - Duplicate detection lookup
   - Metadata collection

4. **VirusTotal Submission**

   - Rate limit compliance
   - Batch processing optimization
   - Error handling and retries
   - Progress tracking

5. **Result Processing**
   - Threat classification
   - Report generation
   - History storage
   - User notification

## 🧪 Testing

### Test Coverage

The project includes comprehensive testing:

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Generate coverage report
npm run test:coverage
```

### Test Categories

- **Unit Tests**: Individual component and utility testing
- **Integration Tests**: Service and hook integration testing
- **E2E Tests**: Full user workflow testing
- **Security Tests**: ZIP processing and validation testing

### Testing Tools

- **Vitest**: Fast unit test runner
- **Testing Library**: React component testing
- **MSW**: API mocking for tests
- **Playwright**: End-to-end testing

## 🔧 Troubleshooting

### Common Issues

#### API Key Issues

```bash
# Error: Invalid API key
# Solution: Verify your VirusTotal API key
echo $VITE_VT_API_KEY  # Should show your key
```

#### Rate Limiting

```bash
# Error: Rate limit exceeded
# Solution: Wait for rate limit reset or upgrade to premium
```

#### Large File Issues

```bash
# Error: File too large
# Solution: Ensure ZIP files are under 100MB
```

#### Browser Compatibility

- **Minimum Requirements**: Chrome 88+, Firefox 85+, Safari 14+
- **Required Features**: IndexedDB, Web Workers, File API

### Debug Mode

Enable debug logging:

```javascript
// In browser console
localStorage.setItem("debug", "vt-scanner:*");
```

## 📈 Roadmap

### Planned Features

- [ ] **Batch ZIP Processing**: Upload multiple ZIP files simultaneously
- [ ] **Advanced Filtering**: More granular history filtering options
- [ ] **Export Reports**: PDF/CSV export of scan results
- [ ] **API Key Management**: Multiple API key support
- [ ] **Scan Scheduling**: Automated periodic rescanning
- [ ] **Integration APIs**: Webhook support for external systems

### Performance Improvements

- [ ] **Web Workers**: Move heavy processing to background threads
- [ ] **Streaming**: Stream large file processing
- [ ] **Caching**: Enhanced caching strategies
- [ ] **Compression**: Optimize storage usage

### Security Enhancements

- [ ] **Advanced Heuristics**: Enhanced malware detection
- [ ] **Sandboxing**: Isolated file processing
- [ ] **Audit Logging**: Comprehensive security logging
- [ ] **CSP Hardening**: Enhanced Content Security Policy

---

<div align="center">

**Built with ❤️ by [N3vvb1e](https://github.com/N3vvb1e)**

_Keeping your files safe, one scan at a time_

</div>
