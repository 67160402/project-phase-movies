# ===== Image สำหรับ API + Frontend (Node.js) =====
FROM node:20-alpine

WORKDIR /app

# คัดลอกเฉพาะไฟล์แพ็กเกจก่อน เพื่อให้ Docker cache ขั้นตอน npm ci ไว้
# (ถ้าไม่ได้แก้ package.json จะไม่ต้องติดตั้งใหม่ทุกครั้งที่ build)
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# คัดลอกโค้ดทั้งหมด (ไฟล์ที่ไม่ต้องการถูกกรองไว้ใน .dockerignore)
COPY . .

ENV PORT=3000
EXPOSE 3000

# รันด้วยผู้ใช้ node แทน root เพื่อความปลอดภัย
USER node

CMD ["node", "src/index.js"]
