// services/vnpayService.js
const crypto = require("crypto");
const qs = require("qs");

class VnpayService {
  constructor() {
    this.tmnCode = process.env.VNP_TMNCODE;
    this.hashSecret = process.env.VNP_HASHSECRET;
    this.vnpUrl =
      process.env.VNP_URL ||
      "https://sandbox.vnpayment.vn/paymentv2/vpcpay.html";
    this.returnUrl = process.env.VNP_RETURNURL;
  }

  // Hàm tạo URL thanh toán
  createPaymentUrl({ amount, orderInfo, ipAddr, txnRef, returnUrl }) {
    const date = new Date();
    const createDate = date
      .toISOString()
      .replace(/[-:TZ.]/g, "")
      .slice(0, 14);

    let vnp_Params = {
      vnp_Version: "2.1.0",
      vnp_Command: "pay",
      vnp_TmnCode: this.tmnCode,
      vnp_Amount: amount * 100, // VNPAY yêu cầu nhân 100
      vnp_CurrCode: "VND",
      vnp_TxnRef: (txnRef || Date.now().toString()).toString(),
      vnp_OrderInfo: orderInfo,
      vnp_OrderType: "other",
      vnp_Locale: "vn",
      vnp_ReturnUrl: returnUrl || this.returnUrl,
      vnp_IpAddr: ipAddr,
      vnp_CreateDate: createDate,
    };

    // Sắp xếp tham số
    vnp_Params = this.sortObject(vnp_Params);

    // Tạo chữ ký
    const signData = qs.stringify(vnp_Params, { encode: false });
    const signed = crypto
      .createHmac("sha512", this.hashSecret)
      .update(Buffer.from(signData, "utf-8"))
      .digest("hex");
    vnp_Params["vnp_SecureHash"] = signed;
    return this.vnpUrl + "?" + qs.stringify(vnp_Params, { encode: false });
  }

  // Hàm verify kết quả trả về
  verifyReturnUrl(query) {
    const vnp_Params = { ...query };
    const secureHash = vnp_Params["vnp_SecureHash"];
    delete vnp_Params["vnp_SecureHash"];
    delete vnp_Params["vnp_SecureHashType"];

    const signData = qs.stringify(this.sortObject(vnp_Params), {
      encode: false,
    });
    const hmac = crypto.createHmac("sha512", this.hashSecret);
    const signed = hmac.update(Buffer.from(signData, "utf-8")).digest("hex");

    return secureHash === signed;
  }

  // Hàm sắp xếp object theo key
  sortObject(obj) {
    const sorted = {};
    const keys = Object.keys(obj).sort();
    keys.forEach((key) => {
      sorted[key] = encodeURIComponent(obj[key]).replace(/%20/g, "+");
    });
    return sorted;
  }
}

module.exports = new VnpayService();
