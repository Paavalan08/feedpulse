# 1. Choose the base operating system (A lightweight version of Linux with Node 18 pre-installed)
FROM node:18-alpine

# 2. Set the working directory inside the container
WORKDIR /app

# 3. Copy only the package files first (This makes future builds much faster)
COPY package*.json ./

# 4. Install dependencies inside the container
RUN npm install

# 5. Copy the rest of your backend code into the container
COPY . .

# 6. Compile the TypeScript into plain JavaScript
RUN npm run build

# 7. Expose the port your server uses
EXPOSE 4000

# 8. The command to start the server when the container turns on
CMD ["npm", "start"]