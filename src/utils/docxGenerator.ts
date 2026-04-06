import { 
  Document, 
  Paragraph, 
  TextRun, 
  AlignmentType, 
  HeadingLevel, 
  Packer, 
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
  ImageRun,
  ExternalHyperlink
} from "docx";
import { saveAs } from "file-saver";

interface ProposalData {
  address: {
    city: string;
    street: string;
    house: string;
    block?: string;
  };
  calculation: {
    entrances: number;
    totalApartments: number;
    smartIntercoms: number;
    additionalCameras: number;
    elevatorCameras: number;
    gates: number;
    tariffPerApt: number;
    rates: {
      smart: number;
      addCam: number;
      elev: number;
      gate: number;
    };
  };
}

export const generateProposalDocx = async (data: ProposalData): Promise<Blob> => {
  const { address, calculation } = data;
  const fullAddress = `${address.city}${address.city ? ", " : ""}ул. ${address.street}, дом ${address.house}${address.block ? ", корп. " + address.block : ""}`;

  // Текст тарифа зависит от состава услуг
  let tariffText = `Ежемесячная оплата за техническое обслуживание домофона – ${calculation.rates.smart} рублей с квартиры в месяц.`;
  
  if (calculation.additionalCameras > 0) {
    tariffText += ` За каждую дополнительную камеру ${calculation.rates.addCam} рублей.`;
  }
  
  if (calculation.elevatorCameras > 0) {
    tariffText += ` Техническое обслуживание лифтового видеонаблюдения ${calculation.rates.elev} руб.`;
  }
  
  if (calculation.gates > 0) {
    // В калькуляторе калитка рассчитывается как gatePrice * smartIntercoms / totalApartments
    // Для КП мы просто указываем итоговый вклад в тариф или общую сумму
    const gateContribution = Math.round((calculation.rates.gate * calculation.smartIntercoms) / calculation.totalApartments);
    tariffText += ` За обслуживание калитки ${gateContribution} руб.`;
  }
  
  tariffText += ` Итого общий тариф составляет ${calculation.tariffPerApt} рублей по квитанциям ООО «ДомофонДар».`;

  // Подготовка логотипа
  let logoImage: ImageRun | null = null;
  try {
    const response = await fetch("/logo.jpg");
    if (response.ok) {
      const buffer = await response.arrayBuffer();
      logoImage = new ImageRun({
        data: new Uint8Array(buffer),
        transformation: {
          width: 120, 
          height: 60,
        },
      } as any);
    }
  } catch (error) {
    console.error("Ошибка загрузки логотипа:", error);
  }

  const doc = new Document({
    sections: [{
      properties: {},
      children: [
        // Логотип (если загружен)
        ...(logoImage ? [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [logoImage],
            spacing: { after: 200 },
          })
        ] : []),
        // Шапка
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [
            new TextRun({
              text: "Общество с ограниченной ответственностью «ДомофонДар»",
              bold: true,
              size: 24,
            }),
          ],
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [
            new TextRun({
              text: "г. Краснодар проезд Репина, дом 1, офис 134",
              size: 20,
            }),
          ],
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [
            new TextRun({
              text: "ИНН 1192375010904   тел. +7(909) 453-62-41",
              size: 20,
            }),
          ],
        }),
        
        new Paragraph({ text: "", spacing: { after: 400 } }),

        // Заголовок КП
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [
            new TextRun({
              text: "Коммерческое предложение",
              bold: true,
              size: 28,
              underline: {},
            }),
          ],
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [
            new TextRun({
              text: `по адресу: ${fullAddress}`,
              bold: true,
              size: 24,
            }),
          ],
        }),

        new Paragraph({ text: "", spacing: { after: 300 } }),

        // Нумерованный список разделов
        new Paragraph({
          children: [new TextRun({ text: "1. Модернизация домофонного оборудования", bold: true })],
          spacing: { before: 200 },
        }),
        ...(calculation.additionalCameras > 0 || calculation.elevatorCameras > 0 ? [
          new Paragraph({
            children: [new TextRun({ text: "2. Модернизация видеонаблюдения", bold: true })]
          }),
          new Paragraph({
            children: [new TextRun({ text: "3. Техническое обслуживание домофонного оборудования", bold: true })]
          }),
          new Paragraph({
            children: [new TextRun({ text: "4. Техническое обслуживание видеонаблюдения", bold: true })]
          })
        ] : [
          new Paragraph({
            children: [new TextRun({ text: "2. Техническое обслуживание домофонного оборудования", bold: true })]
          })
        ]),

        new Paragraph({ text: "", spacing: { after: 200 } }),

        // Тезисы (маркированный список)
        ...[
          "Модернизация установленного домофонного оборудования с заменой на «умный» IP-домофон за счет компании ООО «Домофондар» (центральные блоки вызова, блоки питания, коммутаторы, считыватели, замки, доводчики).",
          ...(calculation.additionalCameras > 0 ? [`Установка дополнительных камер в количестве ${calculation.additionalCameras} шт. за счет компании ООО «ДомофонДар», работа камер в одном приложении с камерой домофона «Умный дом» архив 5 суток.`] : []),
          tariffText,
          "Ранее установленные в квартирах трубки подключаются бесплатно. По желанию, собственники за свой счет могут приобрести новую трубку или видеомонитор в случае их отсутствия в квартире;",
          "Ключи с повышенной защитой от копирования: 1 ключ выдается бесплатно, дополнительные ключи 200 рублей на момент монтажа оборудования, 300 рублей в дальнейшем.",
          "Стоимость подключения к личному кабинету «Умный домофон» 300 рублей единоразово для всех проживающих в 1 квартире.",
          "Полная гарантия на все оборудование!",
          "Бесплатные вызовы и ремонт в неограниченном количестве!",
        ].map(text => new Paragraph({
          text: text,
          bullet: { level: 0 },
          spacing: { before: 120 }
        })),

        new Paragraph({
          children: [
            new TextRun({
              text: "Наше домофонное оборудование имеет следующие функциональные возможности и технические характеристики:",
              bold: true
            })
          ],
          spacing: { before: 300, after: 150 },
        }),

        ...[
          "Разблокировка двери: возможность разблокировки двери с помощью ключа с повышенной защитой от копирования, с помощью аналоговой трубки в квартире, а также из приложения на смартфоне;",
          "Распознавание лица: возможность разблокировки двери с помощью функции распознавания по контуру лица по предварительно загруженным фото (по желанию);",
          "Архив звонков: возможность просмотра истории посещений с фото звонивших в конкретную квартиру;",
          "Временный доступ: возможность жильцу предоставить своим гостям ссылку для временного доступа на выбранный срок (установка приложения не требуется);",
          "Встроенная камера: трансляция, запись и хранение видеопотока с камеры умного домофона 24/7 в облаке в течение 5 дней;",
          "Защита от копирования ключей: Встроенный считыватель стандарта Mifare 1K.",
          "Разрешение IP камеры: 2Mpx (1920x1080) с ИК-подсветкой;",
          "Ночной режим: Высокое качество изображения в темное время суток."
        ].map(text => new Paragraph({
          text: text,
          bullet: { level: 0 },
          spacing: { before: 80 }
        })),

        new Paragraph({
          children: [
            new TextRun({
              text: "Плановое техническое обслуживание домофонной системы проводится один раз в месяц и включает в себя:",
              bold: true
            })
          ],
          spacing: { before: 300, after: 150 },
        }),

        ...[
          "Визуальный осмотр коммуникаций домофонной системы.",
          "Проверка работоспособности системы.",
          "Регулировка и проверка креплений доводчика.",
          "Регулировка зазора между электромагнитным замком и створкой двери.",
          "Очистка рабочих поверхностей замка.",
          "Проверка выходного напряжения блоков питания.",
          "Очистка поверхности вызывного блока от пыли и грязи.",
          "Проверка архива записи с камер домофона.",
          "Замена информационной наклейки.",
          "Проверка надежности коммутации вызывной панели, блока питания, коммутатора."
        ].map(text => new Paragraph({
          text: text,
          bullet: { level: 0 },
          spacing: { before: 80 }
        })),

        new Paragraph({ text: "", spacing: { after: 600 } }),

        // Футер с уведомлением об автогенерации
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [
            new TextRun({
              text: "Коммерческое предложение было сформировано автоматически на сайте компании ООО «ДомофонДар»",
              italics: true,
              size: 20,
            }),
          ],
          spacing: { before: 400 }
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [
            new ExternalHyperlink({
              children: [
                new TextRun({
                  text: "www.domofondar.ru",
                  color: "0000FF",
                  underline: {},
                  size: 20,
                }),
              ],
              link: "http://www.domofondar.ru",
            }),
          ],
        }),
      ],
    }],
  });

  return await Packer.toBlob(doc);
};

export const downloadProposal = async (data: ProposalData) => {
  const blob = await generateProposalDocx(data);
  const fileName = `КП Домофондар ${data.address.street} ${data.address.house}.docx`;
  saveAs(blob, fileName);
};
