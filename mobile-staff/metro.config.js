// metro.config.js — Конфигурация бандлера Metro для служебного приложения «Офис Работа»
// Обеспечивает корректный резолв зависимостей expo-router и модулей в папке mobile-staff
const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

module.exports = config;
