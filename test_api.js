const token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6ImY4N2EzMjljLWRiOTAtNDg4Ni1hYjI1LWZhZmU4NjMyNjA4ZCIsInJvbGUiOiJhdXRoZW50aWNhdGVkIiwiaWF0IjoxNzgwMTcxMDI3fQ.dKODkf0kwSeTDy0EUNobHLvoIE10lLpbYlOy-8d_6WI";

fetch("http://185.104.114.184:3000/promotions", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${token}`
  },
  body: JSON.stringify({
    title: "Test Node Promo",
    description: "Testing API from Node script",
    is_active: true
  })
}).then(async res => {
  console.log("Status:", res.status);
  console.log("Body:", await res.text());
}).catch(console.error);
