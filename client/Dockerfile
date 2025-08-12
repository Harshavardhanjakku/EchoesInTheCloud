# Use a lightweight Node image
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Install dependencies (only package.json + package-lock.json)
COPY package*.json ./
RUN npm ci

# Copy all files
COPY . .

# Build Next.js app
RUN npm run build

# Expose the port Next.js will run on
EXPOSE 3000

# Set environment to production
ENV NODE_ENV=production

# Start Next.js
CMD ["npm", "start"]
