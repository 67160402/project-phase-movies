const rateLimit = require("express-rate-limit");

// Rate Limiter สำหรับ Endpoint ที่เกี่ยวข้องกับ Authentication
// เช่น Register และ Login
// จำกัดจำนวน Request เพื่อช่วยป้องกันการยิง Request ซ้ำ ๆ หรือ Brute Force
const authLimiter = rateLimit({
  // กำหนดช่วงเวลาในการนับ Request = 15 นาที
  windowMs: 15 * 60 * 1000,

  // อนุญาตสูงสุด 10 Request ต่อช่วงเวลา
  max: 10,

  // ส่งข้อมูล Rate Limit ผ่าน Standard Headers
  standardHeaders: "draft-7",

  // ปิดฟังก์ชัน Header รูปแบบเก่า
  legacyHeaders: false,

  // Response เมื่อผู้ใช้เรียกเกินจำนวนที่กำหนด
  message: {
    error: {
      code: "TOO_MANY_REQUESTS",
      message: "พยายามเข้าสู่ระบบมากเกินไป กรุณาลองใหม่ภายหลัง",
    },
  },
});

// Rate Limiter สำหรับ API ทั่วไป
const generalLimiter = rateLimit({
  // กำหนดช่วงเวลาในการนับ Request = 1 นาที
  windowMs: 60 * 1000,

  // อนุญาตสูงสุด 100 Request ต่อ 1 นาที
  max: 100,

  // ส่งข้อมูล Rate Limit ผ่าน Standard Headers
  standardHeaders: "draft-7",

  // ปิดฟังก์ชัน Header รูปแบบเก่า
  legacyHeaders: false,

  // Response เมื่อเรียก API เกินจำนวนที่กำหนด
  message: {
    error: {
      code: "TOO_MANY_REQUESTS",
      message: "มีการเรียก API มากเกินไป กรุณาลองใหม่ภายหลัง",
    },
  },
});

// ส่งออก Rate Limiter ทั้งสองแบบ เพื่อให้ไฟล์อื่นๆ สามารถนำไปใช้งานได้
module.exports = {
  authLimiter,
  generalLimiter,
};
