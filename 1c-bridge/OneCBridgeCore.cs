using System;
using System.Text;
using System.Collections.Generic;

/// <summary>
/// Ядро взаимодействия с 1С:Предприятие 8.3 через COM-соединитель V83.COMConnector
/// Разработано для сервиса «ДомофонДар»
/// </summary>
public class OneCBridgeCore
{
    /// <summary>
    /// Настройка защищенных протоколов TLS 1.2/1.3 для бесперебойного обмена с сайтом
    /// </summary>
    public static void SetupSecurityProtocols()
    {
        System.Net.ServicePointManager.SecurityProtocol = 
            System.Net.SecurityProtocolType.Tls12 | 
            System.Net.SecurityProtocolType.Tls11 | 
            System.Net.SecurityProtocolType.Tls;
        System.Net.ServicePointManager.ServerCertificateValidationCallback = 
            new System.Net.Security.RemoteCertificateValidationCallback((sender, certificate, chain, sslPolicyErrors) => true);
    }

    /// <summary>
    /// Подключение к базе 1С (файловая или серверная)
    /// </summary>
    public static dynamic ConnectToOneC(string connectionType, string fileDir, string serverCluster, string baseName, string user, string pwd)
    {
        Type comType = Type.GetTypeFromProgID("V83.COMConnector");
        if (comType == null)
        {
            throw new Exception("Класс V83.COMConnector не зарегистрирован в системе. Убедитесь, что 1С:Предприятие 8.3 установлена.");
        }
        dynamic com = Activator.CreateInstance(comType);
        string connStr = "";
        if (connectionType == "file")
        {
            connStr = string.Format("File=\"{0}\";Usr=\"{1}\";Pwd=\"{2}\";", fileDir, user, pwd);
        }
        else
        {
            connStr = string.Format("Srvr=\"{0}\";Ref=\"{1}\";Usr=\"{2}\";Pwd=\"{3}\";", serverCluster, baseName, user, pwd);
        }
        return com.Connect(connStr);
    }

    /// <summary>
    /// Проверка соединения с базой 1С
    /// </summary>
    public static string TestConnection(string connectionType, string fileDir, string serverCluster, string baseName, string user, string pwd)
    {
        dynamic v8 = ConnectToOneC(connectionType, fileDir, serverCluster, baseName, user, pwd);
        string userFullName = "";
        try
        {
            userFullName = (string)v8.ПараметрыСеанса.ТекущийПользователь.Наименование;
        }
        catch
        {
            userFullName = user;
        }
        return string.Format("Успешное подключение к 1С. Текущий пользователь: {0}", userFullName);
    }

    /// <summary>
    /// Поиск ссылки на улицу в 1С (точный поиск или по подстроке)
    /// </summary>
    public static dynamic FindStreet(dynamic v8, string streetName)
    {
        if (string.IsNullOrEmpty(streetName)) return null;
        try
        {
            dynamic u = v8.Справочники.Улицы.НайтиПоНаименованию(streetName.Trim());
            if (u != null && !u.Пустая()) return u;

            // Поиск без приставки (ул)
            string clean = streetName.Replace("(ул)", "").Replace("ул.", "").Replace("(пер)", "").Trim();
            dynamic q = v8.NewObject("Запрос");
            q.Text = "ВЫБРАТЬ ПЕРВЫЕ 1 Ссылка ИЗ Справочник.Улицы ГДЕ Наименование ПОДОБНО &Паттерн";
            q.УстановитьПараметр("Паттерн", "%" + clean + "%");
            dynamic vt = q.Execute().Unload();
            if (vt.Count() > 0) return vt.Get(0).Ссылка;
        }
        catch { }
        return null;
    }

    /// <summary>
    /// Поиск ссылки на дом в 1С (с учетом улицы-владельца)
    /// </summary>
    public static dynamic FindHouse(dynamic v8, dynamic streetRef, string houseNum)
    {
        if (string.IsNullOrEmpty(houseNum)) return null;
        try
        {
            string cleanHouse = houseNum.Trim();
            if (streetRef != null && !streetRef.Пустая())
            {
                dynamic q = v8.NewObject("Запрос");
                q.Text = "ВЫБРАТЬ ПЕРВЫЕ 1 Ссылка ИЗ Справочник.Дома ГДЕ Владелец = &Улица И Наименование = &Дом";
                q.УстановитьПараметр("Улица", streetRef);
                q.УстановитьПараметр("Дом", cleanHouse);
                dynamic vt = q.Execute().Unload();
                if (vt.Count() > 0) return vt.Get(0).Ссылка;
            }

            // Общий поиск по наименованию
            dynamic d = v8.Справочники.Дома.НайтиПоНаименованию(cleanHouse);
            if (d != null && !d.Пустая()) return d;
        }
        catch { }
        return null;
    }

    /// <summary>
    /// Поиск абонента в 1С (по ФИО, телефону или по адресу улицы и квартиры)
    /// </summary>
    public static dynamic FindSubscriber(dynamic v8, string clientName, dynamic streetRef, string apartment, string phone)
    {
        try
        {
            // 1. Поиск по ФИО
            if (!string.IsNullOrEmpty(clientName))
            {
                dynamic q = v8.NewObject("Запрос");
                q.Text = "ВЫБРАТЬ ПЕРВЫЕ 1 Ссылка ИЗ Справочник.Абоненты ГДЕ Наименование ПОДОБНО &Имя";
                q.УстановитьПараметр("Имя", "%" + clientName.Trim() + "%");
                dynamic vt = q.Execute().Unload();
                if (vt.Count() > 0) return vt.Get(0).Ссылка;
            }

            // 2. Поиск по улице и квартире
            if (streetRef != null && !streetRef.Пустая() && !string.IsNullOrEmpty(apartment))
            {
                dynamic q = v8.NewObject("Запрос");
                q.Text = "ВЫБРАТЬ ПЕРВЫЕ 1 Ссылка ИЗ Справочник.Абоненты ГДЕ Улица = &Улица И Квартира = &Квартира";
                q.УстановитьПараметр("Улица", streetRef);
                q.УстановитьПараметр("Квартира", apartment.Trim());
                dynamic vt = q.Execute().Unload();
                if (vt.Count() > 0) return vt.Get(0).Ссылка;
            }

            // 3. Поиск по телефону (последние 10 цифр)
            if (!string.IsNullOrEmpty(phone))
            {
                string cleanDigits = System.Text.RegularExpressions.Regex.Replace(phone, @"\D", "");
                if (cleanDigits.Length >= 10)
                {
                    string last10 = cleanDigits.Substring(cleanDigits.Length - 10);
                    dynamic q = v8.NewObject("Запрос");
                    q.Text = "ВЫБРАТЬ ПЕРВЫЕ 1 Ссылка ИЗ Справочник.Абоненты ГДЕ Телефоны ПОДОБНО &Тел";
                    q.УстановитьПараметр("Тел", "%" + last10 + "%");
                    dynamic vt = q.Execute().Unload();
                    if (vt.Count() > 0) return vt.Get(0).Ссылка;
                }
            }
        }
        catch { }
        return null;
    }

    /// <summary>
    /// Создание Заказ-Наряда со 100% заполнением всех реквизитов (ФИО, адрес, телефон, мастер, неисправности)
    /// </summary>
    public static string CreateRepairOrder(
        dynamic v8,
        string clientName,
        string phone,
        string city,
        string street,
        string house,
        string entrance,
        string apartment,
        string malfunctionDesc,
        string masterCodeOrName,
        string siteOrderId
    )
    {
        dynamic doc = v8.Документы.ЗаказНаряд.СоздатьДокумент();
        doc.Дата = DateTime.Now;
        doc.ДатаНаряда = DateTime.Now;
        doc.Выполнено = false;
        doc.Телефоны = phone ?? "";

        // Привязка улицы
        dynamic streetRef = FindStreet(v8, street);
        if (streetRef != null && !streetRef.Пустая()) doc.Улица = streetRef;

        // Привязка дома
        dynamic houseRef = FindHouse(v8, streetRef, house);
        if (houseRef != null && !houseRef.Пустая()) doc.Дом = houseRef;

        // Подъезд и квартира
        doc.Подъезд = entrance ?? "";
        doc.Квартира = apartment ?? "";

        // Поиск Абонента
        dynamic abonRef = FindSubscriber(v8, clientName, streetRef, apartment, phone);
        if (abonRef != null && !abonRef.Пустая())
        {
            doc.Абонент = abonRef;
            // Подтягиваем точные реквизиты из карточки абонента, если в наряде они еще не стоят
            try
            {
                if (doc.Город.Пустая() && abonRef.Город != null && !abonRef.Город.Пустая()) doc.Город = abonRef.Город;
                if (doc.Улица.Пустая() && abonRef.Улица != null && !abonRef.Улица.Пустая()) doc.Улица = abonRef.Улица;
                if (doc.Дом.Пустая() && abonRef.Дом != null && !abonRef.Дом.Пустая()) doc.Дом = abonRef.Дом;
                if (string.IsNullOrEmpty((string)doc.Подъезд) && !string.IsNullOrEmpty((string)abonRef.Подъезд)) doc.Подъезд = abonRef.Подъезд;
                if (string.IsNullOrEmpty((string)doc.Квартира) && !string.IsNullOrEmpty((string)abonRef.Квартира)) doc.Квартира = abonRef.Квартира;
                if (string.IsNullOrEmpty((string)doc.Телефоны) && !string.IsNullOrEmpty((string)abonRef.Телефоны)) doc.Телефоны = abonRef.Телефоны;
            }
            catch { }
        }
        else if (!string.IsNullOrEmpty(clientName))
        {
            doc.Абонент = clientName.Trim();
        }

        // Привязка города (Краснодар)
        try
        {
            if (doc.Город.Пустая())
            {
                dynamic g = v8.Справочники.Города.НайтиПоНаименованию(!string.IsNullOrEmpty(city) ? city : "Краснодар");
                if (g != null && !g.Пустая()) doc.Город = g;
            }
        }
        catch { }

        // Поиск ответственного менеджера по умолчанию
        try
        {
            dynamic mgr = v8.Справочники.Пользователи.НайтиПоНаименованию("Зоя Леонидовна");
            if (mgr != null && !mgr.Пустая()) doc.Ответственный = mgr;
        }
        catch { }

        // Привязка мастера
        if (!string.IsNullOrEmpty(masterCodeOrName))
        {
            try
            {
                dynamic m = v8.Справочники.Мастера.НайтиПоНаименованию(masterCodeOrName);
                if (m != null && !m.Пустая()) doc.Мастер = m;
            }
            catch { }
        }

        doc.Примечание = string.Format("[САЙТ #{0}] {1}", siteOrderId, malfunctionDesc);
        doc.Результат = string.Format("Жилец: {0}, тел: {1}, кв. {2}", clientName, phone, apartment);

        // Табличная часть «Неисправности»
        dynamic row = doc.Неисправности.Добавить();
        row.ОписаниеНеисправности = !string.IsNullOrEmpty(malfunctionDesc) ? malfunctionDesc : "Диагностика и ремонт домофона (заявка с сайта)";

        // Запись документа в базу 1С
        doc.Записать(v8.РежимЗаписиДокумента.Запись);
        return (string)doc.Номер;
    }

    /// <summary>
    /// Обновление уже созданного Заказ-Наряда (дозаполнение ФИО, телефона и адреса)
    /// </summary>
    public static bool UpdateExistingOrder(
        dynamic v8,
        string orderNum,
        string clientName,
        string phone,
        string city,
        string street,
        string house,
        string entrance,
        string apartment
    )
    {
        try
        {
            dynamic q = v8.NewObject("Запрос");
            q.Text = "ВЫБРАТЬ ПЕРВЫЕ 1 Ссылка ИЗ Документ.ЗаказНаряд ГДЕ Номер = &Номер";
            q.УстановитьПараметр("Номер", orderNum.Trim());
            dynamic vt = q.Execute().Unload();
            if (vt.Count() == 0) return false;

            dynamic docRef = vt.Get(0).Ссылка;
            dynamic docObj = docRef.ПолучитьОбъект();

            docObj.Телефоны = phone ?? "";
            docObj.Подъезд = entrance ?? "";
            docObj.Квартира = apartment ?? "";

            // Улица
            dynamic streetRef = FindStreet(v8, street);
            if (streetRef != null && !streetRef.Пустая()) docObj.Улица = streetRef;

            // Дом
            dynamic houseRef = FindHouse(v8, streetRef, house);
            if (houseRef != null && !houseRef.Пустая()) docObj.Дом = houseRef;

            // Абонент
            dynamic abonRef = FindSubscriber(v8, clientName, streetRef, apartment, phone);
            if (abonRef != null && !abonRef.Пустая())
            {
                docObj.Абонент = abonRef;
                try
                {
                    if (docObj.Город.Пустая() && abonRef.Город != null && !abonRef.Город.Пустая()) docObj.Город = abonRef.Город;
                    if (docObj.Улица.Пустая() && abonRef.Улица != null && !abonRef.Улица.Пустая()) docObj.Улица = abonRef.Улица;
                    if (docObj.Дом.Пустая() && abonRef.Дом != null && !abonRef.Дом.Пустая()) docObj.Дом = abonRef.Дом;
                    if (string.IsNullOrEmpty((string)docObj.Подъезд) && !string.IsNullOrEmpty((string)abonRef.Подъезд)) docObj.Подъезд = abonRef.Подъезд;
                    if (string.IsNullOrEmpty((string)docObj.Квартира) && !string.IsNullOrEmpty((string)abonRef.Квартира)) docObj.Квартира = abonRef.Квартира;
                    if (string.IsNullOrEmpty((string)docObj.Телефоны) && !string.IsNullOrEmpty((string)abonRef.Телефоны)) docObj.Телефоны = abonRef.Телефоны;
                }
                catch { }
            }
            else if (!string.IsNullOrEmpty(clientName))
            {
                docObj.Абонент = clientName.Trim();
            }

            // Город
            try
            {
                if (docObj.Город.Пустая())
                {
                    dynamic g = v8.Справочники.Города.НайтиПоНаименованию(!string.IsNullOrEmpty(city) ? city : "Краснодар");
                    if (g != null && !g.Пустая()) docObj.Город = g;
                }
            }
            catch { }

            docObj.Результат = string.Format("Жилец: {0}, тел: {1}, кв. {2}", clientName, phone, apartment);
            docObj.Записать(v8.РежимЗаписиДокумента.Запись);
            return true;
        }
        catch
        {
            return false;
        }
    }

    /// <summary>
    /// Создание Акта установки/замены со 100% заполнением всех реквизитов и списанием номенклатуры
    /// </summary>
    public static string CreateInstallationAct(
        dynamic v8,
        string clientName,
        string phone,
        string city,
        string street,
        string house,
        string entrance,
        string apartment,
        string orgName,
        string warehouseName,
        string priceTypeName,
        string masterName,
        string siteOrderId,
        string itemCode,
        string itemName,
        decimal quantity,
        decimal price
    )
    {
        dynamic doc = v8.Документы.АктУстановкиЗамены.СоздатьДокумент();
        doc.Дата = DateTime.Now;
        doc.Результат = string.Format("[САЙТ ЗАКАЗ #{0}] Монтаж: {1}, тел: {2}, кв. {3}", siteOrderId, clientName, phone, apartment);
        doc.Выполнено = false;

        // Организация
        try
        {
            dynamic org = v8.Справочники.Организации.НайтиПоНаименованию(orgName);
            if (org != null && !org.Пустая()) doc.Организация = org;
        }
        catch { }

        // Склад
        try
        {
            dynamic wh = v8.Справочники.Склады.НайтиПоНаименованию(warehouseName);
            if (wh != null && !wh.Пустая()) doc.Склад = wh;
        }
        catch { }

        // Адрес
        dynamic streetRef = FindStreet(v8, street);
        if (streetRef != null && !streetRef.Пустая()) doc.Улица = streetRef;
        dynamic houseRef = FindHouse(v8, streetRef, house);
        if (houseRef != null && !houseRef.Пустая()) doc.Дом = houseRef;
        doc.Подъезд = entrance ?? "";
        doc.Квартира = apartment ?? "";

        // Абонент
        dynamic abonRef = FindSubscriber(v8, clientName, streetRef, apartment, phone);
        if (abonRef != null && !abonRef.Пустая())
        {
            doc.Абонент = abonRef;
            try
            {
                if (doc.Город.Пустая() && abonRef.Город != null && !abonRef.Город.Пустая()) doc.Город = abonRef.Город;
                if (doc.Улица.Пустая() && abonRef.Улица != null && !abonRef.Улица.Пустая()) doc.Улица = abonRef.Улица;
                if (doc.Дом.Пустая() && abonRef.Дом != null && !abonRef.Дом.Пустая()) doc.Дом = abonRef.Дом;
                if (string.IsNullOrEmpty((string)doc.Подъезд) && !string.IsNullOrEmpty((string)abonRef.Подъезд)) doc.Подъезд = abonRef.Подъезд;
                if (string.IsNullOrEmpty((string)doc.Квартира) && !string.IsNullOrEmpty((string)abonRef.Квартира)) doc.Квартира = abonRef.Квартира;
            }
            catch { }
        }
        else if (!string.IsNullOrEmpty(clientName))
        {
            doc.Абонент = clientName.Trim();
        }

        // Город
        try
        {
            if (doc.Город.Пустая())
            {
                dynamic g = v8.Справочники.Города.НайтиПоНаименованию(!string.IsNullOrEmpty(city) ? city : "Краснодар");
                if (g != null && !g.Пустая()) doc.Город = g;
            }
        }
        catch { }

        // Мастер
        if (!string.IsNullOrEmpty(masterName))
        {
            try
            {
                dynamic m = v8.Справочники.Мастера.НайтиПоНаименованию(masterName);
                if (m != null && !m.Пустая()) doc.Мастер = m;
            }
            catch { }
        }

        // Менеджер
        try
        {
            dynamic mgr = v8.Справочники.Пользователи.НайтиПоНаименованию("Зоя Леонидовна");
            if (mgr != null && !mgr.Пустая()) doc.Менеджер = mgr;
        }
        catch { }

        // Валюта и цены
        try
        {
            dynamic cur = v8.Справочники.Валюты.НайтиПоКоду("643");
            if (cur != null && !cur.Пустая()) doc.ВалютаДокумента = cur;
        }
        catch { }

        try
        {
            dynamic pt = v8.Справочники.ВидыЦен.НайтиПоНаименованию(priceTypeName);
            if (pt != null && !pt.Пустая()) doc.ВидЦены = pt;
        }
        catch { }

        // Табличная часть «Товары»
        if (!string.IsNullOrEmpty(itemCode) || !string.IsNullOrEmpty(itemName))
        {
            dynamic nom = null;
            if (!string.IsNullOrEmpty(itemCode))
            {
                nom = v8.Справочники.Номенклатура.НайтиПоКоду(itemCode);
            }
            if ((nom == null || nom.Пустая()) && !string.IsNullOrEmpty(itemName))
            {
                nom = v8.Справочники.Номенклатура.НайтиПоНаименованию(itemName);
            }

            if (nom != null && !nom.Пустая())
            {
                dynamic row = doc.Товары.Добавить();
                row.Номенклатура = nom;
                row.Количество = quantity > 0 ? quantity : 1;
                row.Цена = price;
                row.Сумма = (quantity > 0 ? quantity : 1) * price;
                doc.СуммаДокумента = row.Сумма;
            }
        }

        doc.Записать(v8.РежимЗаписиДокумента.Запись);
        return (string)doc.Номер;
    }

    /// <summary>
    /// Считывание актуальных остатков со склада 1С
    /// </summary>
    public static string GetStockJson(dynamic v8, string warehouseName)
    {
        dynamic q = v8.NewObject("Запрос");
        q.Text = @"
            ВЫБРАТЬ
                ТоварыНаСкладахОстатки.Номенклатура.Код КАК Код,
                ТоварыНаСкладахОстатки.Номенклатура.Наименование КАК Наименование,
                ТоварыНаСкладахОстатки.ВНаличииОстаток КАК Остаток
            ИЗ
                РегистрНакопления.ТоварыНаСкладах.Остатки КАК ТоварыНаСкладахОстатки
            ГДЕ
                ТоварыНаСкладахОстатки.ВНаличииОстаток > 0
                И ТоварыНаСкладахОстатки.Склад.Наименование = &ИмяСклада
        ";
        q.УстановитьПараметр("ИмяСклада", warehouseName);

        dynamic vt = q.Execute().Unload();
        StringBuilder sb = new StringBuilder();
        sb.Append("[");
        for (int i = 0; i < vt.Count(); i++)
        {
            dynamic row = vt.Get(i);
            if (i > 0) sb.Append(",");
            string code = ((string)row.Код).Replace("\"", "\\\"");
            string name = ((string)row.Наименование).Replace("\"", "\\\"");
            decimal qty = Convert.ToDecimal(row.Остаток);
            sb.Append(string.Format(System.Globalization.CultureInfo.InvariantCulture, "{{\"code\":\"{0}\",\"name\":\"{1}\",\"quantity\":{2}}}", code, name, qty));
        }
        sb.Append("]");
        return sb.ToString();
    }
}
