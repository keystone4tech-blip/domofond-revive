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
    /// Отключение блокировок SSL/TLS для бесперебойной работы шлюза
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
    /// Создание Заказ-Наряда (только ремонты без списания оборудования)
    /// </summary>
    public static string CreateRepairOrder(
        dynamic v8,
        string clientName,
        string phone,
        string city,
        string street,
        string house,
        string apartment,
        string malfunctionDesc,
        string masterCodeOrName,
        string siteOrderId
    )
    {
        dynamic doc = v8.Документы.ЗаказНаряд.СоздатьДокумент();
        doc.Дата = DateTime.Now;
        doc.Примечание = string.Format("[САЙТ #{0}] {1}", siteOrderId, malfunctionDesc);
        doc.Телефоны = phone;
        doc.Выполнено = false;

        // Поиск ответственного менеджера по умолчанию
        try
        {
            dynamic mgr = v8.Справочники.Пользователи.НайтиПоНаименованию("Зоя Леонидовна");
            if (mgr != null && !mgr.Пустая())
            {
                doc.Ответственный = mgr;
            }
        }
        catch { }

        // Привязка мастера, если передан
        if (!string.IsNullOrEmpty(masterCodeOrName))
        {
            try
            {
                dynamic m = v8.Справочники.Мастера.НайтиПоНаименованию(masterCodeOrName);
                if (m != null && !m.Пустая())
                {
                    doc.Мастер = m;
                }
            }
            catch { }
        }

        // Заполнение табличной части «Неисправности»
        dynamic row = doc.Неисправности.Добавить();
        row.ОписаниеНеисправности = !string.IsNullOrEmpty(malfunctionDesc) ? malfunctionDesc : "Диагностика и ремонт домофона (заявка с сайта)";

        // Запись документа в базу 1С
        doc.Записать(v8.РежимЗаписиДокумента.Запись);
        return (string)doc.Номер;
    }

    /// <summary>
    /// Создание Акта установки/замены (монтаж оборудования, ключи, трубки со списанием с Основного склада)
    /// </summary>
    public static string CreateInstallationAct(
        dynamic v8,
        string clientName,
        string phone,
        string city,
        string street,
        string house,
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
        doc.Результат = string.Format("[САЙТ ЗАКАЗ #{0}] Заявка на монтаж оборудования", siteOrderId);
        doc.Выполнено = false;

        // Заполнение Организации
        try
        {
            dynamic org = v8.Справочники.Организации.НайтиПоНаименованию(orgName);
            if (org != null && !org.Пустая()) doc.Организация = org;
        }
        catch { }

        // Заполнение Склада (Основной склад)
        try
        {
            dynamic wh = v8.Справочники.Склады.НайтиПоНаименованию(warehouseName);
            if (wh != null && !wh.Пустая()) doc.Склад = wh;
        }
        catch { }

        // Заполнение Мастера
        if (!string.IsNullOrEmpty(masterName))
        {
            try
            {
                dynamic m = v8.Справочники.Мастера.НайтиПоНаименованию(masterName);
                if (m != null && !m.Пустая()) doc.Мастер = m;
            }
            catch { }
        }

        // Поиск ответственного менеджера
        try
        {
            dynamic mgr = v8.Справочники.Пользователи.НайтиПоНаименованию("Зоя Леонидовна");
            if (mgr != null && !mgr.Пустая()) doc.Менеджер = mgr;
        }
        catch { }

        // Заполнение валюты и вида цен
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

        // Заполнение табличной части «Товары»
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

        // Запись документа
        doc.Записать(v8.РежимЗаписиДокумента.Запись);
        return (string)doc.Номер;
    }

    /// <summary>
    /// Получение актуальных остатков со склада 1С в формате JSON
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
