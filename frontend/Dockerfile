FROM node:20-alpine
WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

# Next.js specific build command
RUN npm run build

# Next.js default port
EXPOSE 3000

# Start the Next.js production server
CMD ["npm", "start"]