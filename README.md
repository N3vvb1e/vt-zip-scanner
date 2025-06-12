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

## 🔧 Configuration

### Environment Variables

| Variable          | Description        | Default | Required |
| ----------------- | ------------------ | ------- | -------- |
| `VITE_VT_API_KEY` | VirusTotal API key | -       | ✅       |

### Security Limits

- **Maximum ZIP size**: 100 MB
- **Maximum uncompressed size**: 500 MB total
- **Maximum files per ZIP**: 1,000 files
- **Maximum nested ZIP depth**: 3 levels
- **Maximum single file size**: 50 MB
- **Compression ratio limits**: Protection against ZIP bombs

## 📖 Usage

1. **Upload ZIP File**: Drag and drop or click to select a ZIP file
2. **Security Analysis**: Automatic security scan with detailed report
3. **File Extraction**: Safe extraction of ZIP contents
4. **VirusTotal Scanning**: Automated submission and result retrieval
5. **Results Review**: Comprehensive scan results with threat analysis

### Key Features

- **Duplicate Detection**: Files are automatically checked against scan history to save API quota
- **History Management**: View all scans with filtering and bulk download options
- **Theme Support**: Light, dark, and system theme options
- **Security Analysis**: Comprehensive ZIP bomb and malware detection

## 🛠️ Development

### Available Scripts

```bash
# Development
npm run dev          # Start development server
npm run build        # Build for production
npm run preview      # Preview production build

# Code Quality
npm run lint         # Run ESLint
```

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

---

<div align="center">

**Built with ❤️ by [N3vvb1e](https://github.com/N3vvb1e)**

_Keeping your files safe, one scan at a time_

</div>
