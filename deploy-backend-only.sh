#!/bin/bash
# Backend-Only Deployment Script
# Choose your deployment platform by uncommenting the relevant section

echo "🚀 Backend Deployment Script"
echo "Choose your deployment platform:"
echo "1. Railway"
echo "2. Render"
echo "3. Heroku"
echo "4. Fly.io"

read -p "Enter choice (1-4): " choice

case $choice in
  1)
    echo "📡 Deploying to Railway..."
    npm install -g @railway/cli
    railway login
    railway init
    railway up
    echo "✅ Backend deployed to Railway!"
    echo "Your backend URL will be displayed above"
    ;;
  2)
    echo "📡 Deploying to Render..."
    echo "Please:"
    echo "1. Push this backend/ folder to GitHub"
    echo "2. Go to render.com"
    echo "3. Connect your GitHub repository"
    echo "4. Select the backend/ folder"
    echo "5. Set build command: npm install"
    echo "6. Set start command: npm start"
    echo "7. Add environment variables from .env.production"
    ;;
  3)
    echo "📡 Deploying to Heroku..."
    npm install -g heroku
    heroku login
    heroku create your-crypto-backend
    git init
    git add .
    git commit -m "Deploy backend to Heroku"
    heroku git:remote -a your-crypto-backend
    git push heroku main
    echo "✅ Backend deployed to Heroku!"
    ;;
  4)
    echo "📡 Deploying to Fly.io..."
    npm install -g @fly.io/flyctl
    flyctl auth login
    flyctl launch
    flyctl deploy
    echo "✅ Backend deployed to Fly.io!"
    ;;
  *)
    echo "❌ Invalid choice. Please run the script again."
    ;;
esac

echo ""
echo "🔗 Next Steps:"
echo "1. Copy your backend URL from the deployment output"
echo "2. Update client/.env with your backend URL:"
echo "   VITE_API_BASE_URL=https://your-backend-url"
echo "   VITE_WS_URL=wss://your-backend-url"
echo "3. Deploy your frontend to Vercel/Netlify/AWS"
echo ""
echo "📊 Available APIs:"
echo "- GET /api/tickers (28 cryptocurrencies)"
echo "- GET /api/market/price/BTCUSDT (live prices)"
echo "- POST /api/webhook/alerts (TradingView signals)"
echo "- POST /api/auth/login (user authentication)"