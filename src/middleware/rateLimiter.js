const rateLimit = require("express-rate-limit");

// Rate Limiter สำหรับ API ทั่วไป
// อนุญาตสูงสุด 100 Request ต่อ 1 นาที ต่อ IP
const generalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,

  // ส่งข้อมูล Rate Limit ผ่าน Standard Headers และปิด Header รูปแบบเก่า
  standardHeaders: "draft-7",
  legacyHeaders: false,

  // Response เมื่อเรียก API เกินจำนวนที่กำหนด
  message: {
    error: {
      code: "TOO_MANY_REQUESTS",
      message: "มีการเรียก API มากเกินไป กรุณาลองใหม่ภายหลัง",
    },
  },
});

module.exports = { generalLimiter };
