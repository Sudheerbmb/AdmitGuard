# Use the official Node.js 18 slim image for a smaller, faster footprint
FROM node:18-slim

# Create and set the working directory
WORKDIR /usr/src/app

# Copy package files first to leverage Docker's layer caching for faster builds
COPY package*.json ./

# Install production dependencies only (skips devDependencies)
RUN npm install --omit=dev

# Copy the rest of your backend source code
COPY . .

# Render automatically sets the PORT environment variable (usually 10000)
# This informs Docker which port the container will listen on
EXPOSE 10000

# Start the application using the start script from package.json
CMD ["npm", "start"]
