FROM node:20-alpine

WORKDIR /app

# Copy package dependency files
COPY api/package*.json ./
RUN npm install

# Copy project files
COPY api/ .

# Generate Prisma client and build
RUN npx prisma generate
RUN npm run build

EXPOSE 3000

CMD ["npm", "start"]
