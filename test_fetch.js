fetch("http://185.104.114.184:3000/promotions").then(async res => {
  console.log("Status:", res.status);
  console.log("Body:", await res.text());
}).catch(console.error);
