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

  // Расчет компонентов тарифа (аналогично Calculator.tsx)
  const smartPrice = calculation.smartIntercoms > 0 ? calculation.rates.smart : 0;
  const addCamPrice = calculation.additionalCameras > 0 ? Math.ceil(calculation.additionalCameras / calculation.entrances) * calculation.rates.addCam : 0;
  const elevPrice = calculation.elevatorCameras > 0 ? Math.ceil(calculation.elevatorCameras / calculation.entrances) * calculation.rates.elev : 0;

  // Для калитки берем либо расчетную стоимость из калькулятора, либо 0
  const gateMaintenanceCost = 5500;
  const gatePrice = calculation.gates > 0 ? Math.ceil(((calculation.gates * gateMaintenanceCost) / calculation.totalApartments) / 5) * 5 : 0;

  // Текст тарифа зависит от состава услуг
  let tariffTextArray = [`Ежемесячная оплата за техническое обслуживание домофона – ${smartPrice} рублей с квартиры в месяц.`];

  if (addCamPrice > 0) {
    tariffTextArray.push(`За каждое дополнительное видеонаблюдение (камеры на придомовой территории) – ${addCamPrice} рублей.`);
  }

  if (elevPrice > 0) {
    tariffTextArray.push(`Техническое обслуживание лифтового видеонаблюдения – ${elevPrice} руб.`);
  }

  if (gatePrice > 0) {
    tariffTextArray.push(`За обслуживание калитки – ${gatePrice} руб.`);
  }

  const tariffText = tariffTextArray.join(" ") + ` Итого общий тариф составляет ${calculation.tariffPerApt} рублей по квитанциям ООО «ДомофонДар».`;

  // Подготовка логотипа
  let logoImage: ImageRun | null = null;
  try {
    const response = await fetch("/logo.jpg");
    if (response.ok) {
      const buffer = await response.arrayBuffer();
      logoImage = new ImageRun({
        data: new Uint8Array(buffer),
        transformation: {
          width: 300,
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

        // Динамические разделы с номерами
        ...(() => {
          let sectionIdx = 1;
          const items: Paragraph[] = [];
          
          // 1. Домофон (Всегда)
          items.push(new Paragraph({
            children: [new TextRun({ text: `${sectionIdx++}. Модернизация или установка домофонного оборудования за счет компании (бесплатно)`, bold: true })],
            spacing: { before: 200 },
          }));
          items.push(new Paragraph({
            children: [new TextRun({ text: `${sectionIdx++}. Техническое обслуживание установленного домофонного оборудования`, bold: true })]
          }));
          
          // 2. Доп. камеры
          if (calculation.additionalCameras > 0) {
            items.push(new Paragraph({
              children: [new TextRun({ text: `${sectionIdx++}. Установка системы видеонаблюдения за счет компании (бесплатно)`, bold: true })]
            }));
            items.push(new Paragraph({
              children: [new TextRun({ text: `${sectionIdx++}. Техническое обслуживание установленного видеонаблюдения`, bold: true })]
            }));
          }
          
          // 3. Камеры в лифте
          if (calculation.elevatorCameras > 0) {
            items.push(new Paragraph({
              children: [new TextRun({ text: `${sectionIdx++}. Установка системы видеонаблюдения в лифте за счет компании (бесплатно)`, bold: true })]
            }));
            items.push(new Paragraph({
              children: [new TextRun({ text: `${sectionIdx++}. Техническое обслуживание видеонаблюдения в лифте`, bold: true })]
            }));
          }
          
          // 4. Калитки
          if (calculation.gates > 0) {
            items.push(new Paragraph({
              children: [new TextRun({ text: `${sectionIdx++}. Установка или модернизация калитки за счет компании (бесплатно)`, bold: true })]
            }));
            items.push(new Paragraph({
              children: [new TextRun({ text: `${sectionIdx++}. Техническое обслуживание калитки`, bold: true })]
            }));
          }
          
          return items;
        })(),

        new Paragraph({ text: "", spacing: { after: 200 } }),

        // Тезисы (маркированный список)
        ...[
          "Установка и модернизация установленного домофонного оборудования с заменой на «умный» IP-домофон за счет компании ООО «Домофондар» (бесплатно).",
          ...(calculation.additionalCameras > 0 ? [`Установка системы видеонаблюдения на придомовой территории за счет компании ООО «Домофондар» (количество дополнительных камер: ${calculation.additionalCameras} шт.), работа камер в одном приложении с камерой домофона «Умный дом» архив 5 суток.`] : []),
          ...(calculation.elevatorCameras > 0 ? [`Установка системы видеонаблюдения в кабинах лифтов за счет компании ООО «Домофондар» (количество камер в лифте: ${calculation.elevatorCameras} шт.).`] : []),
          ...(calculation.gates > 0 ? [`Ранее установленные калитки (двери) на территории дома модернизируются или устанавливаются новые за счет компании ООО «Домофондар».`] : []),
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

        new Paragraph({ text: "", spacing: { before: 400 } }),

        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [
            new TextRun({
              text: "ИНФОРМАЦИЯ О КОМПАНИИ",
              bold: true,
              size: 24,
            }),
          ],
          spacing: { before: 200, after: 100 },
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [new TextRun({ text: "Название: ", bold: true }), new TextRun("ООО «ДомофонДар»")],
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [
            new TextRun({ text: "Адрес офиса: ", bold: true }),
            new TextRun("г. Краснодар, проезд Репина, 1, офис 134 (вход находится с обратной стороны дома, за 1 подъездом)")
          ],
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [new TextRun({ text: "Телефон: ", bold: true }), new TextRun("+7 (903) 411-83-93")],
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [new TextRun({ text: "Email: ", bold: true }), new TextRun("domofondar@mail.ru")],
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
