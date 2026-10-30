const axios = require("axios");

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// ลองเรียก API สูงสุด 3 ครั้ง (ครั้งแรก + Retry 2 ครั้ง)
// Timeout 5 วินาที และหน่วงเวลา 500ms กับ 1,000ms ระหว่าง Retry
async function searchExternalMovie(title) {
  const fallback = {
    source: "fallback",
    message: "ไม่สามารถเชื่อมต่อ External API ได้ ข้อมูลนี้เป็นข้อมูลสำรอง",
    data: {
      Title: title,
      Year: "Unknown",
      Plot: "External movie information is temporarily unavailable.",
    },
  };

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      // จำลองความล้มเหลวเพื่อทดสอบ Retry และ Fallback
      if (process.env.OMDB_FORCE_FAILURE === "true") {
        throw new Error("Simulated external API failure");
      }

      // จำลอง Timeout เพื่อทดสอบ Retry และ Fallback
      if (process.env.OMDB_FORCE_TIMEOUT === "true") {
        const timeoutError = new Error("timeout of 5000ms exceeded");
        timeoutError.code = "ECONNABORTED";
        throw timeoutError;
      }

      const response = await axios.get("https://www.omdbapi.com/", {
        params: {
          apikey: process.env.OMDB_API_KEY,
          t: title,
          plot: "short",
        },
        timeout: 5000,
      });

      if (response.data.Response === "False") {
        return {
          source: "omdb",
          message: response.data.Error || "ไม่พบข้อมูลภาพยนตร์",
          data: null,
        };
      }

      return {
        source: "omdb",
        message: "ค้นหาข้อมูลภาพยนตร์จาก External API สำเร็จ",
        data: response.data,
      };
    } catch (err) {
      const status = err.response?.status;
      const retryable = !status || status >= 500;

      // แสดงจำนวนครั้งที่เรียกไม่สำเร็จใน Terminal
      console.warn(
        `External API attempt ${attempt + 1}/3 failed:`,
        err.message,
      );

      // ถ้าไม่ใช่ข้อผิดพลาดที่ควร Retry หรือ Retry ครบแล้ว
      // ให้ส่งข้อมูลสำรองกลับไป
      if (!retryable || attempt === 2) {
        console.error("External API failed. Returning fallback.");
        return fallback;
      }

      // หน่วงเวลาก่อนลองใหม่
      await sleep(500 * (attempt + 1));
    }
  }

  return fallback;
}

module.exports = { searchExternalMovie };
