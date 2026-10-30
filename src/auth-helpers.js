const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

// จำนวนรอบในการทำ Hash Password เพื่อเพิ่มความปลอดภัย (ค่าเริ่มต้นคือ 10 รอบ)
const SALT_ROUNDS = 10;

// แปลง Password ธรรมดาให้เป็น Password Hash ก่อนบันทึกลง Database
async function hashPassword(plainPassword) {
  return bcrypt.hash(plainPassword, SALT_ROUNDS);
}

// เปรียบเทียบรหัสผ่านที่ผู้ใช้กรอกเข้ามา กับรหัสผ่านที่ถูก Hash ไว้ใน Database
async function verifyPassword(plainPassword, hashedPassword) {
  return bcrypt.compare(plainPassword, hashedPassword);
}

// สร้าง JWT Token หลังจาก Login สำเร็จ
function generateToken(user) {
  // ใส่เฉพาะข้อมูลที่จำเป็นลงใน Token เช่น id, email และ role ของผู้ใช้
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      role: user.role,
    },

    // Secret Key ที่ใช้สำหรับ Sign และ Verify Token
    process.env.JWT_SECRET,

    // กำหนดอายุของ Token (สามารถกำหนดได้ในไฟล์ .env) เช่น 2 ชั่วโมง
    {
      expiresIn: process.env.JWT_EXPIRES_IN || "2h",
    },
  );
}

// ส่งออก Function เพื่อให้ไฟล์อื่นๆ สามารถนำไปใช้งานได้ เช่น Middleware
module.exports = {
  hashPassword,
  verifyPassword,
  generateToken,
};
