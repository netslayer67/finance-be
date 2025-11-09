# Financial Dashboard System

A comprehensive financial reporting and analysis system for IQRA and ICBM organizations, built with React, Express.js, MongoDB, and real-time features.

## 📋 Features

- **Real-time Dashboard** - Live financial data updates using WebSocket
- **Excel File Upload** - Drag & drop Excel files with automatic parsing
- **Multi-sheet Consolidation** - One workbook can include IQRA & ICBM sheets that are auto-detected and merged per period
- **Cumulative Intelligence** - Lifetime and year-to-date rollups with organization/account breakdowns
- **Financial Data Management** - Complete CRUD operations for financial records
- **Advanced Analytics** - Charts, trends, and comparative analysis
- **Multi-organization Support** - IQRA and ICBM data consolidation
- **Responsive Design** - Mobile-friendly interface with Tailwind CSS
- **Data Validation** - Built-in validation and error handling
- **Export Capabilities** - Export reports to Excel format

## 🏗️ Technology Stack

### Backend
- **Node.js** with **Express.js** - RESTful API server
- **MongoDB** with **Mongoose** - Database and ODM
- **Socket.IO** - Real-time WebSocket communication
- **ExcelJS** - Excel file processing
- **Multer** - File upload handling

### Frontend
- **React 18** - Modern React with hooks
- **Vite** - Fast build tool and dev server
- **Tailwind CSS** - Utility-first CSS framework
- **Recharts** - Data visualization and charts
- **React Router** - Client-side routing
- **Axios** - HTTP client
- **Socket.IO Client** - Real-time communication

## 📁 Project Structure

```
financial-dashboard-system/
├── server/                    # Backend application
│   ├── config/
│   │   └── database.js       # MongoDB connection
│   ├── models/
│   │   ├── FinancialRecord.js # Financial data schema
│   │   └── FileUpload.js     # File upload tracking
│   ├── routes/
│   │   ├── financial.js      # Financial records API
│   │   ├── upload.js         # File upload API
│   │   ├── reports.js        # Reports generation
│   │   └── dashboard.js      # Dashboard data API
│   ├── uploads/              # Uploaded files storage
│   └── index.js              # Server entry point
├── client/                   # Frontend application
│   ├── src/
│   │   ├── components/       # Reusable components
│   │   │   ├── layout/       # Layout components
│   │   │   ├── dashboard/    # Dashboard components
│   │   │   └── common/       # Common UI components
│   │   ├── context/          # React context providers
│   │   ├── pages/            # Page components
│   │   ├── App.jsx           # Main app component
│   │   ├── main.jsx          # App entry point
│   │   └── index.css         # Global styles
│   ├── package.json
│   ├── vite.config.js
│   ├── tailwind.config.js
│   └── index.html
├── package.json              # Root package.json
├── .env                      # Environment variables
└── README.md                 # This file
```

## 🚀 Quick Start

### Prerequisites

- **Node.js** (v16 or higher)
- **MongoDB** (v5 or higher)
- **npm** or **yarn**

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd financial-dashboard-system
   ```

2. **Install dependencies**
   ```bash
   # Install root dependencies
   npm install
   
   # Install client dependencies
   cd client && npm install
   cd ..
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   ```
   
   Edit `.env` file:
   ```env
   NODE_ENV=development
   PORT=5000
   MONGODB_URI=mongodb://gamificat01_db_user:DdlxMFg7gbt5sKdO@ac-y5mkqbh-shard-00-00.ekcm26f.mongodb.net:27017,ac-y5mkqbh-shard-00-01.ekcm26f.mongodb.net:27017,ac-y5mkqbh-shard-00-02.ekcm26f.mongodb.net:27017/?replicaSet=atlas-27ya7b-shard-0&ssl=true&authSource=admin
   JWT_SECRET=your_jwt_secret_here
   ALLOWED_ORIGINS=http://localhost:5173
   ```

4. **Start MongoDB**
   ```bash
   # If using MongoDB locally
   mongod
   
   # Or use Docker
   docker run -d -p 27017:27017 --name mongodb mongo:latest
   ```

5. **Start the backend API**
   ```bash
   # Development mode (backend only)
   npm run dev
   
   # Production mode
   npm start
   ```

   **Start the frontend locally**
   ```bash
   cd client
   npm install   # first run only
   npm run dev
   ```

6. **Access the application**
   - Frontend: http://localhost:5173
   - Backend API: http://localhost:5000
   - API Health Check: http://localhost:5000/health

## 📊 Usage Guide

### 1. Uploading Financial Data

1. **Navigate to Upload page** from the sidebar
2. **Drag and drop Excel files** or click to browse
3. **Fill in metadata**:
   - Organization (IQRA/ICBM)
   - Month (JAN, FEB, etc.)
   - Year (2024, 2025, etc.)
4. **Click "Upload"** to process the files

#### Excel File Format

The system expects Excel files with the following structure:
- **Sheet 1**: IQRA data
- **Sheet 2**: ICBM data
- **Columns**: Description | Ecobank | NBS Bank
- **Naming**: Files should be named like "Iqraa income & expense-JAN 25.xlsx"

#### Sample Data Structure:
```
Description           | Ecobank    | NBS Bank
Opening Balance       | 1,074,760  | -6,175,336
Tuition Fees          | 7,546,000  | 0
Hostel Fees           | 200,000    | 0
Salaries              | 23,651,745 | 0
Electricity           | 560,000    | 0
Closing Balance       | 1,961,375  | 19,559,772
```

### 2. Dashboard Overview

- **Real-time statistics** showing total income, expenses, and net profit
- **Interactive charts** displaying financial trends
- **Recent activity** feed showing latest uploads
- **Organization filtering** to view specific data

### 3. Financial Records Management

- **View all records** with filtering and pagination
- **Edit records** inline or through forms
- **Delete records** with confirmation
- **Search and filter** by organization, account, year

### 4. Reports Generation

- **Consolidated Reports** - Combined financial data analysis
- **Comparative Analysis** - Period-over-period comparisons
- **Organization Summaries** - Detailed breakdown by organization
- **Export to Excel** for external analysis

## 🔧 API Documentation

### Financial Records API

```
GET    /api/financial           - Get all financial records
GET    /api/financial/:id       - Get single record
POST   /api/financial           - Create new record
PUT    /api/financial/:id       - Update record
DELETE /api/financial/:id       - Delete record
GET    /api/financial/summary/statistics - Get summary stats
GET    /api/financial/trends/monthly     - Get monthly trends
```

### File Upload API

```
POST   /api/upload/excel        - Upload Excel file
GET    /api/upload/history      - Get upload history
GET    /api/upload/:id          - Get upload details
```

### Dashboard API

```
GET    /api/dashboard/overview  - Get dashboard overview
GET    /api/dashboard/charts    - Get chart data
GET    /api/dashboard/stats     - Get real-time stats
GET    /api/dashboard/health    - System health check
```

### Reports API

```
GET    /api/reports/consolidated    - Consolidated report
GET    /api/reports/comparative     - Comparative analysis
GET    /api/reports/organization-summary - Organization summary
```

## 🔄 Real-time Features

The system includes real-time updates using WebSocket connections:

- **Live dashboard updates** when new data is added
- **File upload progress** notifications
- **Record changes** broadcast to all connected clients
- **System status** monitoring

## 🛡️ Security Features

- **Input validation** using express-validator
- **Rate limiting** to prevent abuse
- **CORS protection** for cross-origin requests
- **Helmet.js** for security headers
- **File type validation** for uploads
- **SQL injection protection** through Mongoose

## 🎨 Customization

### Styling
The system uses Tailwind CSS with a custom color palette:
- **Primary**: Blue tones for main actions
- **Success**: Green for positive values
- **Warning**: Orange for alerts
- **Danger**: Red for negative values

### Adding New Organizations
1. Update the organization enum in `FinancialRecord.js`
2. Add to the dropdown options in frontend components
3. Update validation rules

### Custom Charts
Modify the `ChartCard.jsx` component to add new chart types using Recharts.

## 🧪 Testing

```bash
# Run server tests
npm test

# Run client tests
cd client && npm test
```

## 📦 Production Deployment

### Environment Setup
1. **Set production environment variables** (see `.env.example`)
   ```env
   NODE_ENV=production
   PORT=5000
   MONGODB_URI=mongodb://gamificat01_db_user:DdlxMFg7gbt5sKdO@ac-y5mkqbh-shard-00-00.ekcm26f.mongodb.net:27017,ac-y5mkqbh-shard-00-01.ekcm26f.mongodb.net:27017,ac-y5mkqbh-shard-00-02.ekcm26f.mongodb.net:27017/?replicaSet=atlas-27ya7b-shard-0&ssl=true&authSource=admin
   JWT_SECRET=replace_with_strong_secret
   ALLOWED_ORIGINS=https://finance-beige-nine.vercel.app
   ```
   *Set `ALLOWED_ORIGINS` to a comma-separated list of all front-end URLs that should be able to call the API/Socket server.*
2. **Use MongoDB Atlas** for cloud database (URI above already points to the managed cluster)
3. **Configure CORS** using `ALLOWED_ORIGINS` so Vercel/other deploys can reach the API
4. **Set up SSL/HTTPS** certificates
5. **Use PM2** for process management

### Front-end Environment (Vite / Vercel)
Create `client/.env` (or configure Vercel project env variables):
```
VITE_API_BASE_URL=https://your-backend-domain.com/api
VITE_SOCKET_URL=wss://your-backend-domain.com
```
For the current deployment these can point to the same domain that hosts the Express server. The Vercel-hosted UI at `https://finance-beige-nine.vercel.app` must include these values so all API calls and Socket.IO connections go to the production backend.

### Build for Production
```bash
# Build client
cd client && npm run build

# Start production server
NODE_ENV=production npm start
```

### Docker Deployment
```dockerfile
# Dockerfile example
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 5000
CMD ["npm", "start"]
```

## 🐛 Troubleshooting

### Common Issues

1. **MongoDB Connection Error**
   - Ensure MongoDB is running
   - Check connection string in `.env`
   - Verify network access permissions

2. **File Upload Fails**
   - Check file size limits (10MB default)
   - Ensure correct Excel format
   - Verify required metadata fields

3. **Charts Not Displaying**
   - Check browser console for errors
   - Ensure data is in correct format
   - Verify API responses

4. **Real-time Updates Not Working**
   - Check WebSocket connection status
   - Verify Socket.IO server is running
   - Check browser network tab

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 👥 Support

For support and questions:
- Create an issue on GitHub
- Check the documentation
- Review the API endpoints
- Test with sample data

## 🔄 Version History

- **v1.0.0** - Initial release with full functionality
  - Excel file upload and parsing
  - Real-time dashboard
  - Financial records management
  - Reports generation
  - Responsive design

## 📋 Roadmap

- [ ] Advanced user authentication
- [ ] Role-based access control
- [ ] Advanced reporting features
- [ ] Mobile app companion
- [ ] Data import/export wizards
- [ ] Audit trail functionality
- [ ] Multi-currency support
- [ ] Automated backups

---

**Note**: This system is designed specifically for IQRA and ICBM financial data. The Excel parsing logic is customized for the specific format used by these organizations.
