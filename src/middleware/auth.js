const jwt = require("jsonwebtoken");

// Middleware สำหรับตรวจสอบ Token ที่ผู้ใช้ส่งมาพร้อมกับ Request
function authenticateToken(req, res, next) {
  // อ่านค่า Authorization Header จาก Request
  // รูปแบบที่คาดหวังคือ Authorization: Bearer <token>
  const authHeader = req.headers.authorization;

  // แยก Header ออกจาก Token เพื่อให้ได้เฉพาะ Token จริงๆ
  const token = authHeader && authHeader.split(" ")[1];

  // ถ้าไม่มี Token แสดงว่ายังไม่ได้เข้าสู่ระบบ Status 401 Unauthorized
  if (!token) {
    return res.status(401).json({
      error: {
        code: "NO_TOKEN",
        message: "กรุณาเข้าสู่ระบบก่อนใช้งาน",
      },
    });
  }

  try {
    // ตรวจสอบว่า Token ถูกสร้างจาก Secret Key ของระบบหรือไม่
    // ถ้า Token ถูกต้อง จะเก็บข้อมูลผู้ใช้ไว้ใน req.user เพื่อให้ Middleware หรือ Endpoint ถัดไปสามารถเข้าถึงข้อมูลผู้ใช้ได้
    req.user = jwt.verify(token, process.env.JWT_SECRET);

    // ส่ง Request ไปยัง Middleware หรือ Endpoint ถัดไป
    next();
  } catch (err) {
    // ถ้า Token ไม่ถูกต้องหรือหมดอายุ Status 401 Unauthorized
    return res.status(401).json({
      error: {
        code: "INVALID_TOKEN",
        message: "Token ไม่ถูกต้องหรือหมดอายุ",
      },
    });
  }
}

// Middleware สำหรับตรวจสอบสิทธิ์ของผู้ใช้ตาม Role ที่กำหนดไว้ใน Endpoint
// เช่น authorizeRole("admin") หมายถึงเฉพาะ Admin เท่านั้นที่สามารถเข้าถึง Endpoint นี้ได้
function authorizeRole(...allowedRoles) {
  return (req, res, next) => {
    // ตรวจสอบว่ามีข้อมูลผู้ใช้จาก Token หรือไม่ ถ้าไม่มีแสดงว่ายังไม่ได้เข้าสู่ระบบ Status 401 Unauthorized
    if (!req.user) {
      return res.status(401).json({
        error: {
          code: "NO_TOKEN",
          message: "กรุณาเข้าสู่ระบบก่อนใช้งาน",
        },
      });
    }

    // ตรวจสอบว่า Role ของผู้ใช้ว่าอยู่ในรายการ Role ที่อนุญาตหรือไม่
    if (!allowedRoles.includes(req.user.role)) {
      // ถ้า Login แล้วแต่ไม่มีสิทธิ์ ให้ตอบ 403 Forbidden
      return res.status(403).json({
        error: {
          code: "FORBIDDEN",
          message: "คุณไม่มีสิทธิ์เข้าถึง",
        },
      });
    }

    // ถ้ามีสิทธิ์ ให้ดำเนินการต่อได้โดยเรียก next()
    next();
  };
}

// ส่งออก Middleware เพื่อให้ index.js หรือไฟล์อื่นนำไปใช้งานได้
module.exports = {
  authenticateToken,
  authorizeRole,
};
