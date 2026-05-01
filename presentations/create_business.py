#!/usr/bin/env python3
"""Бизнес-презентация проекта Юрист 2.0"""

from pptx import Presentation
from pptx.util import Inches, Pt, Emu
from pptx.dml.color import RGBColor
from pptx.enum.shapes import MSO_SHAPE
from pptx.enum.text import PP_ALIGN, MSO_ANCHOR
from pptx.oxml.ns import qn
from lxml import etree

# Цветовая палитра (премиум deep blue + золото)
NAVY = RGBColor(0x0A, 0x1F, 0x44)
DEEP_BLUE = RGBColor(0x14, 0x2D, 0x6F)
ACCENT = RGBColor(0xD4, 0xAF, 0x37)  # золото
LIGHT_BG = RGBColor(0xF5, 0xF7, 0xFA)
WHITE = RGBColor(0xFF, 0xFF, 0xFF)
TEXT_DARK = RGBColor(0x1A, 0x1A, 0x2E)
TEXT_GREY = RGBColor(0x5A, 0x6A, 0x7A)
GREEN = RGBColor(0x10, 0xB9, 0x81)
RED = RGBColor(0xE5, 0x3E, 0x3E)

prs = Presentation()
prs.slide_width = Inches(13.333)
prs.slide_height = Inches(7.5)

SW = prs.slide_width
SH = prs.slide_height
BLANK = prs.slide_layouts[6]


def add_bg(slide, color=WHITE):
    bg = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, 0, 0, SW, SH)
    bg.fill.solid()
    bg.fill.fore_color.rgb = color
    bg.line.fill.background()
    return bg


def add_text(slide, left, top, width, height, text, *, font_size=18,
             bold=False, color=TEXT_DARK, align=PP_ALIGN.LEFT,
             font_name="Calibri", anchor=MSO_ANCHOR.TOP):
    tb = slide.shapes.add_textbox(left, top, width, height)
    tf = tb.text_frame
    tf.word_wrap = True
    tf.margin_left = 0
    tf.margin_right = 0
    tf.margin_top = 0
    tf.margin_bottom = 0
    tf.vertical_anchor = anchor
    lines = text.split("\n") if isinstance(text, str) else text
    for i, line in enumerate(lines):
        p = tf.paragraphs[0] if i == 0 else tf.add_paragraph()
        p.alignment = align
        run = p.add_run()
        run.text = line
        run.font.name = font_name
        run.font.size = Pt(font_size)
        run.font.bold = bold
        run.font.color.rgb = color
    return tb


def add_rect(slide, left, top, width, height, fill, line_color=None):
    sh = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, left, top, width, height)
    sh.fill.solid()
    sh.fill.fore_color.rgb = fill
    if line_color:
        sh.line.color.rgb = line_color
    else:
        sh.line.fill.background()
    sh.shadow.inherit = False
    return sh


def add_round(slide, left, top, width, height, fill, line_color=None):
    sh = slide.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, left, top, width, height)
    sh.adjustments[0] = 0.15
    sh.fill.solid()
    sh.fill.fore_color.rgb = fill
    if line_color:
        sh.line.color.rgb = line_color
    else:
        sh.line.fill.background()
    sh.shadow.inherit = False
    return sh


def add_oval(slide, left, top, width, height, fill):
    sh = slide.shapes.add_shape(MSO_SHAPE.OVAL, left, top, width, height)
    sh.fill.solid()
    sh.fill.fore_color.rgb = fill
    sh.line.fill.background()
    sh.shadow.inherit = False
    return sh


def add_footer(slide, page_num, total):
    add_rect(slide, 0, SH - Inches(0.4), SW, Inches(0.4), NAVY)
    add_text(slide, Inches(0.4), SH - Inches(0.38), Inches(8), Inches(0.35),
             "Юрист 2.0  |  AI правовая платформа", font_size=10, color=WHITE)
    add_text(slide, SW - Inches(2.5), SH - Inches(0.38), Inches(2), Inches(0.35),
             f"{page_num} / {total}", font_size=10, color=ACCENT, align=PP_ALIGN.RIGHT)


def header(slide, title, subtitle=None):
    add_rect(slide, 0, 0, SW, Inches(0.15), ACCENT)
    add_text(slide, Inches(0.6), Inches(0.4), Inches(12), Inches(0.7),
             title, font_size=32, bold=True, color=NAVY)
    if subtitle:
        add_text(slide, Inches(0.6), Inches(1.1), Inches(12), Inches(0.4),
                 subtitle, font_size=15, color=TEXT_GREY)


TOTAL = 16

# ==================== СЛАЙД 1: ТИТУЛЬНЫЙ ====================
s = prs.slides.add_slide(BLANK)
add_bg(s, NAVY)
# Декор - геометрические фигуры
add_oval(s, Inches(-2), Inches(-2), Inches(5), Inches(5), DEEP_BLUE)
add_oval(s, Inches(11), Inches(5), Inches(4), Inches(4), DEEP_BLUE)

# Логотип-плашка
add_round(s, Inches(0.8), Inches(0.8), Inches(2.4), Inches(0.8), ACCENT)
add_text(s, Inches(0.8), Inches(0.85), Inches(2.4), Inches(0.7),
         "ЮРИСТ 2.0", font_size=20, bold=True, color=NAVY,
         align=PP_ALIGN.CENTER, anchor=MSO_ANCHOR.MIDDLE)

# Главный заголовок
add_text(s, Inches(0.8), Inches(2.3), Inches(11.7), Inches(1.5),
         "AI-платформа правовой поддержки", font_size=54, bold=True, color=WHITE)
add_text(s, Inches(0.8), Inches(3.4), Inches(11.7), Inches(1),
         "малого и среднего бизнеса России", font_size=44, color=ACCENT)

# Тэглайн
add_rect(s, Inches(0.8), Inches(4.7), Inches(0.08), Inches(0.4), ACCENT)
add_text(s, Inches(1.0), Inches(4.7), Inches(11), Inches(0.5),
         "Каждое предприятие — со своим юристом. На базе ИИ.",
         font_size=20, color=WHITE)

# Автор
add_text(s, Inches(0.8), Inches(6.2), Inches(11), Inches(0.4),
         "Хадызов Зураб Джамалаевич", font_size=16, color=WHITE, bold=True)
add_text(s, Inches(0.8), Inches(6.6), Inches(11), Inches(0.4),
         "МГИМО  |  Факультет управления и политики  |  3 курс",
         font_size=13, color=ACCENT)
add_text(s, Inches(0.8), Inches(6.95), Inches(11), Inches(0.4),
         "2026", font_size=12, color=WHITE)

# ==================== СЛАЙД 2: ПРОБЛЕМА ====================
s = prs.slides.add_slide(BLANK)
add_bg(s)
header(s, "Проблема российского бизнеса", "Юридические услуги — недоступная роскошь для МСП")

# 4 проблемы в карточках
problems = [
    ("73%", "малых компаний не имеют\nштатного юриста",
     "Услуги внешних юристов — от 5 000 ₽/час"),
    ("40%", "договоров содержат\nскрытые риски",
     "Бизнес подписывает контракты вслепую"),
    ("3,2 трлн ₽", "потери МСП от\nнедобросовестных контрагентов",
     "По данным ФССП и арбитражных судов за 2024 г."),
    ("87%", "предпринимателей не знают\nсудебной практики по своей сфере",
     "Решения принимаются интуитивно"),
]

x_start = Inches(0.6)
y_start = Inches(2.0)
card_w = Inches(3.0)
card_h = Inches(4.3)
gap = Inches(0.13)

for i, (num, title, desc) in enumerate(problems):
    x = x_start + (card_w + gap) * i
    add_round(s, x, y_start, card_w, card_h, LIGHT_BG)
    add_rect(s, x, y_start, card_w, Inches(0.08), RED)
    add_text(s, x, y_start + Inches(0.6), card_w, Inches(1.2),
             num, font_size=42, bold=True, color=RED, align=PP_ALIGN.CENTER)
    add_text(s, x + Inches(0.2), y_start + Inches(2.1), card_w - Inches(0.4),
             Inches(1.4), title, font_size=15, bold=True, color=TEXT_DARK,
             align=PP_ALIGN.CENTER)
    add_text(s, x + Inches(0.2), y_start + Inches(3.3), card_w - Inches(0.4),
             Inches(1), desc, font_size=11, color=TEXT_GREY, align=PP_ALIGN.CENTER)

add_footer(s, 2, TOTAL)

# ==================== СЛАЙД 3: РЕШЕНИЕ ====================
s = prs.slides.add_slide(BLANK)
add_bg(s)
header(s, "Наше решение", "Юрист 2.0 — комплексная AI-платформа для бизнеса")

# Большая центральная плашка
add_round(s, Inches(0.6), Inches(2.0), Inches(12.1), Inches(1.4), NAVY)
add_text(s, Inches(0.6), Inches(2.3), Inches(12.1), Inches(0.9),
         "Один сервис — все юридические задачи МСП",
         font_size=26, bold=True, color=WHITE, align=PP_ALIGN.CENTER,
         anchor=MSO_ANCHOR.MIDDLE)

# 4 столбца возможностей
features = [
    ("🛡", "Проверка контрагентов", "Скоринг рисков по\nЕГРЮЛ, КАД, ФССП,\nDaData"),
    ("📄", "Анализ договоров", "AI находит риски,\nпробелы, ссылки на\nГК РФ и судпрактику"),
    ("✍", "Генерация документов", "Шаблоны договоров,\nисковых, претензий —\nза 30 секунд"),
    ("⚖", "База законов и практики", "Онлайн-доступ к\nкодексам и решениям\nверховного суда"),
]

card_w2 = Inches(2.95)
gap2 = Inches(0.15)
x_start2 = Inches(0.6)
y_start2 = Inches(3.7)

for i, (icon, title, desc) in enumerate(features):
    x = x_start2 + (card_w2 + gap2) * i
    add_round(s, x, y_start2, card_w2, Inches(3.0), WHITE,
              line_color=RGBColor(0xE0, 0xE5, 0xEC))
    # Иконка
    add_oval(s, x + Inches(1.1), y_start2 + Inches(0.2), Inches(0.8),
             Inches(0.8), ACCENT)
    add_text(s, x + Inches(1.1), y_start2 + Inches(0.2), Inches(0.8),
             Inches(0.8), icon, font_size=24, bold=True, color=NAVY,
             align=PP_ALIGN.CENTER, anchor=MSO_ANCHOR.MIDDLE)
    add_text(s, x + Inches(0.15), y_start2 + Inches(1.2), card_w2 - Inches(0.3),
             Inches(0.8), title, font_size=16, bold=True, color=NAVY,
             align=PP_ALIGN.CENTER)
    add_text(s, x + Inches(0.2), y_start2 + Inches(2.0), card_w2 - Inches(0.4),
             Inches(1), desc, font_size=12, color=TEXT_GREY,
             align=PP_ALIGN.CENTER)

add_footer(s, 3, TOTAL)

# ==================== СЛАЙД 4: КАК ЭТО РАБОТАЕТ ====================
s = prs.slides.add_slide(BLANK)
add_bg(s)
header(s, "Как это работает", "Простой путь от запроса до готового решения")

steps = [
    ("1", "Загрузка", "Пользователь загружает\nдоговор или вводит ИНН"),
    ("2", "AI-анализ", "ИИ изучает документ:\nриски, формулировки,\nпрецеденты"),
    ("3", "Запрос данных", "Платформа делает\nзапросы в DaData, ЕГРЮЛ,\nкартотеку судов"),
    ("4", "Юр. оценка", "Привязка к статьям\nГК РФ, ТК, НК,\nсудебной практике"),
    ("5", "Результат", "Отчёт + рекомендации\nили готовый документ\nза 30 секунд"),
]

x = Inches(0.6)
y = Inches(2.2)
step_w = Inches(2.4)
step_h = Inches(3.5)
gap = Inches(0.05)

for i, (num, title, desc) in enumerate(steps):
    sx = x + (step_w + gap) * i
    add_round(s, sx, y, step_w, step_h, LIGHT_BG)
    add_oval(s, sx + step_w / 2 - Inches(0.5), y + Inches(0.3), Inches(1),
             Inches(1), NAVY)
    add_text(s, sx + step_w / 2 - Inches(0.5), y + Inches(0.3), Inches(1),
             Inches(1), num, font_size=32, bold=True, color=ACCENT,
             align=PP_ALIGN.CENTER, anchor=MSO_ANCHOR.MIDDLE)
    add_text(s, sx + Inches(0.15), y + Inches(1.5), step_w - Inches(0.3),
             Inches(0.6), title, font_size=18, bold=True, color=NAVY,
             align=PP_ALIGN.CENTER)
    add_text(s, sx + Inches(0.15), y + Inches(2.2), step_w - Inches(0.3),
             Inches(1.2), desc, font_size=12, color=TEXT_GREY,
             align=PP_ALIGN.CENTER)
    # Стрелка
    if i < len(steps) - 1:
        ax = sx + step_w + Inches(-0.15)
        ay = y + step_h / 2 - Inches(0.1)
        arrow = s.shapes.add_shape(MSO_SHAPE.RIGHT_ARROW, ax, ay,
                                   Inches(0.3), Inches(0.2))
        arrow.fill.solid()
        arrow.fill.fore_color.rgb = ACCENT
        arrow.line.fill.background()

# Метрика снизу
add_round(s, Inches(0.6), Inches(6.1), Inches(12.1), Inches(0.7), NAVY)
add_text(s, Inches(0.6), Inches(6.15), Inches(12.1), Inches(0.6),
         "⏱  Среднее время обработки: 30 секунд  |  💰 Экономия для бизнеса: до 90% от стоимости услуг юриста",
         font_size=14, color=ACCENT, align=PP_ALIGN.CENTER,
         anchor=MSO_ANCHOR.MIDDLE, bold=True)

add_footer(s, 4, TOTAL)

# ==================== СЛАЙД 5: РЫНОК ====================
s = prs.slides.add_slide(BLANK)
add_bg(s)
header(s, "Рынок и его потенциал", "LegalTech — самая быстрорастущая ниша в России")

# Большие цифры рынка
metrics = [
    ("450 млрд ₽", "Объём рынка\nюр.услуг РФ", "2024 г."),
    ("28%", "CAGR LegalTech\nсегмента", "2024–2028"),
    ("6,2 млн", "субъектов МСП —\nцелевая аудитория", "Реестр ФНС"),
    ("82 млрд ₽", "Прогноз LegalTech\nрынка России", "к 2028 г."),
]

x = Inches(0.6)
y = Inches(2.0)
mw = Inches(2.95)
gap = Inches(0.15)

for i, (val, lbl, src) in enumerate(metrics):
    sx = x + (mw + gap) * i
    add_round(s, sx, y, mw, Inches(2.4), DEEP_BLUE)
    add_text(s, sx, y + Inches(0.3), mw, Inches(1),
             val, font_size=32, bold=True, color=ACCENT,
             align=PP_ALIGN.CENTER)
    add_text(s, sx + Inches(0.2), y + Inches(1.3), mw - Inches(0.4), Inches(0.8),
             lbl, font_size=13, color=WHITE, align=PP_ALIGN.CENTER)
    add_text(s, sx + Inches(0.2), y + Inches(2.0), mw - Inches(0.4), Inches(0.3),
             src, font_size=10, color=ACCENT, align=PP_ALIGN.CENTER)

# Тренды снизу
add_text(s, Inches(0.6), Inches(4.7), Inches(12), Inches(0.4),
         "Ключевые тренды рынка:", font_size=18, bold=True, color=NAVY)

trends = [
    "Цифровизация госуслуг: ФНС, Госуслуги, ЕГРЮЛ — открытые API",
    "Малому бизнесу нужны юридические инструменты, а не дорогие консультанты",
    "Государство стимулирует внедрение AI в B2B (нацпроект «Цифровая экономика»)",
    "Уход западных LegalTech-сервисов открыл нишу для российских решений",
]

for i, t in enumerate(trends):
    ty = Inches(5.2) + Inches(0.4) * i
    add_oval(s, Inches(0.7), ty + Inches(0.07), Inches(0.15), Inches(0.15),
             ACCENT)
    add_text(s, Inches(1.0), ty, Inches(11), Inches(0.4),
             t, font_size=13, color=TEXT_DARK)

add_footer(s, 5, TOTAL)

# ==================== СЛАЙД 6: ЦЕЛЕВАЯ АУДИТОРИЯ ====================
s = prs.slides.add_slide(BLANK)
add_bg(s)
header(s, "Целевая аудитория", "Кто заплатит за продукт")

audiences = [
    ("PRIMARY", "Малый и средний бизнес",
     ["ИП и ООО без штатного юриста",
      "Стартапы и быстрорастущие компании",
      "Розничная торговля, услуги, IT"],
     "6,2 млн потенциальных клиентов", NAVY),
    ("SECONDARY", "Юристы-фрилансеры",
     ["Частнопрактикующие юристы",
      "Адвокаты до 5 лет опыта",
      "Юр. консультанты"],
     "120 000 специалистов в РФ", DEEP_BLUE),
    ("ENTERPRISE", "Юридические отделы",
     ["Корпоративные юр. отделы",
      "HR и compliance департаменты",
      "Закупки и тендеры"],
     "12 000 средних предприятий", RGBColor(0x1E, 0x4A, 0x8C)),
]

x = Inches(0.6)
y = Inches(2.0)
aw = Inches(4.05)
ah = Inches(4.7)
gap = Inches(0.1)

for i, (tag, name, items, size, color) in enumerate(audiences):
    sx = x + (aw + gap) * i
    add_round(s, sx, y, aw, ah, color)
    # Тэг
    add_round(s, sx + Inches(0.3), y + Inches(0.3), Inches(1.5), Inches(0.4),
              ACCENT)
    add_text(s, sx + Inches(0.3), y + Inches(0.32), Inches(1.5), Inches(0.4),
             tag, font_size=11, bold=True, color=NAVY,
             align=PP_ALIGN.CENTER, anchor=MSO_ANCHOR.MIDDLE)
    # Название
    add_text(s, sx + Inches(0.3), y + Inches(0.9), aw - Inches(0.6), Inches(0.8),
             name, font_size=22, bold=True, color=WHITE)
    # Список
    for j, item in enumerate(items):
        ty = y + Inches(2.0) + Inches(0.45) * j
        add_text(s, sx + Inches(0.4), ty, Inches(0.2), Inches(0.4),
                 "▸", font_size=14, bold=True, color=ACCENT)
        add_text(s, sx + Inches(0.7), ty, aw - Inches(1.0), Inches(0.4),
                 item, font_size=13, color=WHITE)
    # Размер
    add_rect(s, sx + Inches(0.3), y + Inches(3.9), aw - Inches(0.6),
             Inches(0.05), ACCENT)
    add_text(s, sx + Inches(0.3), y + Inches(4.05), aw - Inches(0.6), Inches(0.5),
             size, font_size=14, bold=True, color=ACCENT,
             align=PP_ALIGN.CENTER)

add_footer(s, 6, TOTAL)

# ==================== СЛАЙД 7: БИЗНЕС-МОДЕЛЬ ====================
s = prs.slides.add_slide(BLANK)
add_bg(s)
header(s, "Бизнес-модель", "SaaS подписка с тремя тарифами + B2B контракты")

tariffs = [
    ("FREE", "0 ₽", "/мес",
     ["3 проверки контрагентов",
      "1 анализ документа",
      "Базовая БД законов",
      "Web-доступ"],
     "Привлечение пользователей", LIGHT_BG, TEXT_DARK, TEXT_GREY),
    ("PRO", "1 990 ₽", "/мес",
     ["Безлимит проверок",
      "30 анализов документов",
      "Генерация документов",
      "Полная судебная практика",
      "Email поддержка"],
     "Основной продукт", NAVY, WHITE, ACCENT),
    ("BUSINESS", "9 990 ₽", "/мес",
     ["Всё из PRO",
      "До 5 пользователей",
      "API доступ",
      "Кастомные шаблоны",
      "Персональный менеджер"],
     "Юр. отделы и B2B", DEEP_BLUE, WHITE, ACCENT),
    ("ENTERPRISE", "от 50 000 ₽", "/мес",
     ["Кастомизация платформы",
      "Интеграция с CRM/ERP",
      "On-premise установка",
      "SLA 99,9%",
      "Юридический аудит"],
     "Крупные корпорации", RGBColor(0x14, 0x14, 0x2A), WHITE, ACCENT),
]

x = Inches(0.4)
y = Inches(1.9)
tw = Inches(3.05)
th = Inches(4.9)
gap = Inches(0.1)

for i, (name, price, per, items, desc, bg, txt, accent) in enumerate(tariffs):
    sx = x + (tw + gap) * i
    add_round(s, sx, y, tw, th, bg)
    if name == "PRO":
        # Бейдж "Популярный"
        add_round(s, sx + tw - Inches(1.4), y - Inches(0.2), Inches(1.3),
                  Inches(0.45), ACCENT)
        add_text(s, sx + tw - Inches(1.4), y - Inches(0.18), Inches(1.3),
                 Inches(0.4), "ПОПУЛЯРНО", font_size=10, bold=True, color=NAVY,
                 align=PP_ALIGN.CENTER, anchor=MSO_ANCHOR.MIDDLE)
    add_text(s, sx, y + Inches(0.3), tw, Inches(0.5),
             name, font_size=18, bold=True, color=accent,
             align=PP_ALIGN.CENTER)
    add_text(s, sx, y + Inches(0.95), tw, Inches(0.7),
             price, font_size=26, bold=True, color=txt,
             align=PP_ALIGN.CENTER)
    add_text(s, sx, y + Inches(1.65), tw, Inches(0.3),
             per, font_size=11, color=accent, align=PP_ALIGN.CENTER)
    # Линия
    add_rect(s, sx + Inches(0.5), y + Inches(2.05), tw - Inches(1),
             Inches(0.02), accent)
    # Список фич
    for j, item in enumerate(items):
        ty = y + Inches(2.25) + Inches(0.35) * j
        add_text(s, sx + Inches(0.2), ty, Inches(0.15), Inches(0.3),
                 "✓", font_size=12, bold=True, color=accent)
        add_text(s, sx + Inches(0.45), ty, tw - Inches(0.55), Inches(0.3),
                 item, font_size=11, color=txt)
    # Описание
    add_text(s, sx + Inches(0.2), y + th - Inches(0.5), tw - Inches(0.4),
             Inches(0.4), desc, font_size=10, color=accent,
             align=PP_ALIGN.CENTER)

add_footer(s, 7, TOTAL)

# ==================== СЛАЙД 8: ФИН. МОДЕЛЬ ====================
s = prs.slides.add_slide(BLANK)
add_bg(s)
header(s, "Финансовая модель", "Прогноз на 3 года")

# Левая часть - юнит-экономика
add_round(s, Inches(0.6), Inches(1.9), Inches(6), Inches(5), LIGHT_BG)
add_text(s, Inches(0.8), Inches(2.1), Inches(5.6), Inches(0.5),
         "Юнит-экономика (на 1 клиента PRO)",
         font_size=18, bold=True, color=NAVY)

unit = [
    ("ARPU (средний чек)", "1 990 ₽/мес", GREEN),
    ("CAC (стоимость привлечения)", "1 200 ₽", TEXT_DARK),
    ("LTV (доход с клиента)", "23 880 ₽", GREEN),
    ("LTV/CAC", "19,9×", ACCENT),
    ("Маржа после AI-затрат", "82%", GREEN),
    ("Окупаемость клиента", "0,6 мес", GREEN),
]

for i, (lbl, val, color) in enumerate(unit):
    ty = Inches(2.8) + Inches(0.6) * i
    add_text(s, Inches(0.9), ty, Inches(3.5), Inches(0.5),
             lbl, font_size=13, color=TEXT_DARK)
    add_text(s, Inches(4.4), ty, Inches(2), Inches(0.5),
             val, font_size=15, bold=True, color=color, align=PP_ALIGN.RIGHT)

# Правая часть - выручка по годам
add_round(s, Inches(6.85), Inches(1.9), Inches(6.1), Inches(5), NAVY)
add_text(s, Inches(7.05), Inches(2.1), Inches(5.7), Inches(0.5),
         "Прогноз выручки", font_size=18, bold=True, color=ACCENT)

years = [
    ("2026", "5 200 клиентов", "12,4 млн ₽", Inches(1.3)),
    ("2027", "28 000 клиентов", "67 млн ₽", Inches(2.8)),
    ("2028", "120 000 клиентов", "287 млн ₽", Inches(4.0)),
]

for i, (year, clients, rev, bar_h) in enumerate(years):
    bx = Inches(7.2) + Inches(1.85) * i
    bar_y = Inches(6.5) - bar_h
    add_rect(s, bx, bar_y, Inches(1.5), bar_h, ACCENT)
    add_text(s, bx, bar_y - Inches(0.4), Inches(1.5), Inches(0.4),
             rev, font_size=12, bold=True, color=WHITE,
             align=PP_ALIGN.CENTER)
    add_text(s, bx, Inches(6.55), Inches(1.5), Inches(0.3),
             year, font_size=13, bold=True, color=ACCENT,
             align=PP_ALIGN.CENTER)

add_footer(s, 8, TOTAL)

# ==================== СЛАЙД 9: КОНКУРЕНТЫ ====================
s = prs.slides.add_slide(BLANK)
add_bg(s)
header(s, "Конкурентный анализ", "Чем мы отличаемся от существующих игроков")

# Таблица конкурентов
columns = ["Сервис", "AI-анализ", "Контрагенты", "Генерация", "Цена/мес"]
rows = [
    ("Юрист 2.0", "✓ Полный", "✓ DaData+ЕГРЮЛ", "✓ AI-генерация", "от 1 990 ₽", True),
    ("Контур.Фокус", "—", "✓ Только проверка", "—", "от 4 800 ₽", False),
    ("СПАРК", "—", "✓ Расширенная", "—", "от 12 000 ₽", False),
    ("КонсультантПлюс", "—", "—", "Шаблоны", "от 8 000 ₽", False),
    ("Doczilla", "Базовый", "—", "✓ Шаблоны", "от 2 990 ₽", False),
    ("Право.ru", "—", "—", "—", "от 5 000 ₽", False),
]

# Шапка
y = Inches(2.0)
col_widths = [Inches(2.5), Inches(2.3), Inches(2.5), Inches(2.5), Inches(2.4)]
x_positions = [Inches(0.6)]
for w in col_widths[:-1]:
    x_positions.append(x_positions[-1] + w)

# Header row
for i, col in enumerate(columns):
    add_rect(s, x_positions[i], y, col_widths[i], Inches(0.5), NAVY)
    add_text(s, x_positions[i], y + Inches(0.05), col_widths[i], Inches(0.4),
             col, font_size=13, bold=True, color=ACCENT,
             align=PP_ALIGN.CENTER, anchor=MSO_ANCHOR.MIDDLE)

# Data rows
for ri, (name, ai, count, gen, price, is_us) in enumerate(rows):
    ry = y + Inches(0.5) + Inches(0.55) * ri
    bg_color = ACCENT if is_us else (LIGHT_BG if ri % 2 == 0 else WHITE)
    text_color = NAVY if is_us else TEXT_DARK
    bold = is_us
    for ci, val in enumerate([name, ai, count, gen, price]):
        add_rect(s, x_positions[ci], ry, col_widths[ci], Inches(0.55),
                 bg_color, line_color=RGBColor(0xE0, 0xE5, 0xEC))
        add_text(s, x_positions[ci], ry + Inches(0.05), col_widths[ci],
                 Inches(0.45), val, font_size=12, bold=bold, color=text_color,
                 align=PP_ALIGN.CENTER, anchor=MSO_ANCHOR.MIDDLE)

# Преимущество
add_round(s, Inches(0.6), Inches(6.2), Inches(12.1), Inches(0.7), GREEN)
add_text(s, Inches(0.6), Inches(6.25), Inches(12.1), Inches(0.6),
         "💡 Уникально: единственный сервис с full-stack AI-анализом + проверкой контрагентов в одном продукте",
         font_size=14, bold=True, color=WHITE, align=PP_ALIGN.CENTER,
         anchor=MSO_ANCHOR.MIDDLE)

add_footer(s, 9, TOTAL)

# ==================== СЛАЙД 10: ТЕХНОЛОГИИ ====================
s = prs.slides.add_slide(BLANK)
add_bg(s)
header(s, "Технологический стек", "Современная архитектура enterprise-уровня")

categories = [
    ("Frontend", ["Next.js 16", "React 19", "TypeScript 5", "Tailwind CSS 4"]),
    ("Backend", ["Next.js API", "NextAuth.js", "Prisma ORM", "PostgreSQL (Neon)"]),
    ("AI / ML", ["Claude 4.5 Sonnet", "Gemini 2.0", "Groq LPU", "Custom prompts"]),
    ("Интеграции", ["DaData API", "ЕГРЮЛ", "КАД", "ФССП"]),
]

x = Inches(0.6)
y = Inches(2.0)
cw = Inches(2.95)
ch = Inches(3.5)
gap = Inches(0.15)

for i, (cat, techs) in enumerate(categories):
    sx = x + (cw + gap) * i
    add_round(s, sx, y, cw, ch, LIGHT_BG)
    add_rect(s, sx, y, cw, Inches(0.6), NAVY)
    add_text(s, sx, y + Inches(0.05), cw, Inches(0.5),
             cat, font_size=16, bold=True, color=ACCENT,
             align=PP_ALIGN.CENTER, anchor=MSO_ANCHOR.MIDDLE)
    for j, tech in enumerate(techs):
        ty = y + Inches(0.9) + Inches(0.55) * j
        add_round(s, sx + Inches(0.3), ty, cw - Inches(0.6), Inches(0.45),
                  WHITE, line_color=RGBColor(0xCC, 0xD3, 0xDC))
        add_text(s, sx + Inches(0.3), ty + Inches(0.05), cw - Inches(0.6),
                 Inches(0.35), tech, font_size=12, color=TEXT_DARK,
                 align=PP_ALIGN.CENTER, anchor=MSO_ANCHOR.MIDDLE)

# Деплой
add_round(s, Inches(0.6), Inches(6.0), Inches(12.1), Inches(0.85), DEEP_BLUE)
add_text(s, Inches(0.8), Inches(6.05), Inches(11.7), Inches(0.4),
         "Облачная инфраструктура", font_size=12, bold=True, color=ACCENT)
add_text(s, Inches(0.8), Inches(6.4), Inches(11.7), Inches(0.4),
         "Vercel (CDN + Edge Functions)  ·  Neon (PostgreSQL)  ·  GitHub Actions (CI/CD)  ·  HTTPS + Auto-scaling",
         font_size=12, color=WHITE)

add_footer(s, 10, TOTAL)

# ==================== СЛАЙД 11: ROADMAP ====================
s = prs.slides.add_slide(BLANK)
add_bg(s)
header(s, "Дорожная карта развития", "От MVP до лидера рынка")

roadmap = [
    ("Q4 2025", "MVP", ["Анализ документов", "Скоринг контрагентов",
                          "База законов", "Деплой в продакшен"], GREEN, "СДЕЛАНО"),
    ("Q1 2026", "Запуск", ["Платная подписка", "Интеграция эквайринга",
                              "Маркетинг", "B2C продажи"], ACCENT, "В РАБОТЕ"),
    ("Q2-Q3 2026", "Рост", ["Mobile-приложение", "API для разработчиков",
                            "Telegram-бот", "Расширение БД"], DEEP_BLUE, "ПЛАН"),
    ("Q4 2026", "Масштаб", ["Корп. версия", "Интеграции с CRM/1C",
                            "Региональные представительства", "Whitelabel"], NAVY, "ПЛАН"),
    ("2027+", "Экспансия", ["Выход в СНГ", "Голосовой ассистент",
                            "AI-арбитраж", "IPO подготовка"],
     RGBColor(0x14, 0x14, 0x2A), "ВИДЕНИЕ"),
]

x = Inches(0.4)
y = Inches(2.0)
rw = Inches(2.55)
rh = Inches(4.6)
gap = Inches(0.1)

for i, (period, name, items, color, status) in enumerate(roadmap):
    sx = x + (rw + gap) * i
    add_round(s, sx, y, rw, rh, color)
    # Период сверху
    add_text(s, sx, y + Inches(0.3), rw, Inches(0.4),
             period, font_size=14, bold=True, color=ACCENT,
             align=PP_ALIGN.CENTER)
    # Статус
    add_round(s, sx + Inches(0.4), y + Inches(0.85), rw - Inches(0.8),
              Inches(0.35), WHITE)
    add_text(s, sx + Inches(0.4), y + Inches(0.87), rw - Inches(0.8),
             Inches(0.3), status, font_size=10, bold=True, color=color,
             align=PP_ALIGN.CENTER, anchor=MSO_ANCHOR.MIDDLE)
    # Название этапа
    add_text(s, sx, y + Inches(1.4), rw, Inches(0.5),
             name, font_size=20, bold=True, color=WHITE,
             align=PP_ALIGN.CENTER)
    # Линия
    add_rect(s, sx + Inches(0.5), y + Inches(2.0), rw - Inches(1),
             Inches(0.02), ACCENT)
    # Задачи
    for j, item in enumerate(items):
        ty = y + Inches(2.2) + Inches(0.5) * j
        add_text(s, sx + Inches(0.2), ty, Inches(0.15), Inches(0.4),
                 "•", font_size=14, bold=True, color=ACCENT)
        add_text(s, sx + Inches(0.4), ty, rw - Inches(0.5), Inches(0.4),
                 item, font_size=11, color=WHITE)

add_footer(s, 11, TOTAL)

# ==================== СЛАЙД 12: ТЕКУЩИЕ РЕЗУЛЬТАТЫ ====================
s = prs.slides.add_slide(BLANK)
add_bg(s)
header(s, "Что уже сделано", "Платформа запущена в продакшен")

# Большая шапка с цифрой
add_round(s, Inches(0.6), Inches(1.9), Inches(12.1), Inches(1.0), GREEN)
add_text(s, Inches(0.6), Inches(2.0), Inches(12.1), Inches(0.8),
         "✓ MVP в продакшене  |  Vercel + Neon PostgreSQL  |  Реальные API-интеграции",
         font_size=20, bold=True, color=WHITE, align=PP_ALIGN.CENTER,
         anchor=MSO_ANCHOR.MIDDLE)

# 6 фич в 2 ряда
features = [
    ("✓", "AI-анализ документов",
     "Загрузка PDF/DOCX, извлечение рисков,\nссылки на статьи ГК РФ"),
    ("✓", "Проверка контрагентов",
     "Реальная интеграция с DaData:\nданные ЕГРЮЛ, статус, фин. показатели"),
    ("✓", "Скоринг рисков",
     "Алгоритм оценки надёжности\nна основе 8+ факторов"),
    ("✓", "Генерация документов",
     "AI создаёт договоры, иски,\nпретензии по запросу"),
    ("✓", "База российского права",
     "ГК РФ, ТК РФ, НК РФ, КоАП,\nполнотекстовый поиск"),
    ("✓", "Авторизация и тарифы",
     "JWT-аутентификация,\nGoogle OAuth, FREE/PRO/BUSINESS"),
]

x = Inches(0.6)
y = Inches(3.1)
fw = Inches(3.95)
fh = Inches(1.7)
gap = Inches(0.1)

for i, (mark, title, desc) in enumerate(features):
    row = i // 3
    col = i % 3
    sx = x + (fw + gap) * col
    sy = y + (fh + gap) * row
    add_round(s, sx, sy, fw, fh, LIGHT_BG)
    add_oval(s, sx + Inches(0.2), sy + Inches(0.25), Inches(0.5),
             Inches(0.5), GREEN)
    add_text(s, sx + Inches(0.2), sy + Inches(0.27), Inches(0.5),
             Inches(0.5), mark, font_size=18, bold=True, color=WHITE,
             align=PP_ALIGN.CENTER, anchor=MSO_ANCHOR.MIDDLE)
    add_text(s, sx + Inches(0.85), sy + Inches(0.2), fw - Inches(1.0),
             Inches(0.5), title, font_size=14, bold=True, color=NAVY)
    add_text(s, sx + Inches(0.85), sy + Inches(0.7), fw - Inches(1.0),
             Inches(0.95), desc, font_size=11, color=TEXT_GREY)

add_footer(s, 12, TOTAL)

# ==================== СЛАЙД 13: КОМАНДА ====================
s = prs.slides.add_slide(BLANK)
add_bg(s)
header(s, "Команда и компетенции", "Авторская разработка студента МГИМО")

# Большая карточка автора
add_round(s, Inches(0.6), Inches(2.0), Inches(12.1), Inches(2.5), NAVY)
# Аватар-круг
add_oval(s, Inches(1.0), Inches(2.4), Inches(1.7), Inches(1.7), ACCENT)
add_text(s, Inches(1.0), Inches(2.4), Inches(1.7), Inches(1.7),
         "ХЗ", font_size=40, bold=True, color=NAVY,
         align=PP_ALIGN.CENTER, anchor=MSO_ANCHOR.MIDDLE)

add_text(s, Inches(3.0), Inches(2.3), Inches(9), Inches(0.6),
         "Хадызов Зураб Джамалаевич", font_size=24, bold=True, color=WHITE)
add_text(s, Inches(3.0), Inches(2.9), Inches(9), Inches(0.4),
         "Основатель и разработчик", font_size=14, color=ACCENT)
add_text(s, Inches(3.0), Inches(3.4), Inches(9), Inches(0.4),
         "МГИМО МИД России  ·  Факультет управления и политики  ·  3 курс",
         font_size=12, color=WHITE)
add_text(s, Inches(3.0), Inches(3.85), Inches(9), Inches(0.5),
         "Компетенции: full-stack разработка, AI-инжиниринг, продуктовое мышление, управление проектами",
         font_size=11, color=WHITE)

# Что планируется добавить в команду
add_text(s, Inches(0.6), Inches(4.85), Inches(12), Inches(0.4),
         "Планируемые роли в команде после привлечения инвестиций:",
         font_size=15, bold=True, color=NAVY)

roles = [
    ("CTO", "Архитектура и команда\nразработки"),
    ("Юрист-эксперт", "Контент,\nверификация"),
    ("Sales", "B2B продажи,\nпартнёрства"),
    ("Marketing", "Performance, контент,\nPR"),
]

x = Inches(0.6)
y = Inches(5.45)
rw = Inches(2.95)
rh = Inches(1.4)
gap = Inches(0.15)

for i, (role, desc) in enumerate(roles):
    sx = x + (rw + gap) * i
    add_round(s, sx, y, rw, rh, LIGHT_BG)
    add_text(s, sx, y + Inches(0.2), rw, Inches(0.5),
             role, font_size=16, bold=True, color=NAVY,
             align=PP_ALIGN.CENTER)
    add_text(s, sx + Inches(0.15), y + Inches(0.7), rw - Inches(0.3),
             Inches(0.7), desc, font_size=11, color=TEXT_GREY,
             align=PP_ALIGN.CENTER)

add_footer(s, 13, TOTAL)

# ==================== СЛАЙД 14: ИНВЕСТИЦИИ ====================
s = prs.slides.add_slide(BLANK)
add_bg(s)
header(s, "Инвестиционная привлекательность", "Чего мы ищем и что предлагаем")

# Слева - сумма и условия
add_round(s, Inches(0.6), Inches(1.9), Inches(6), Inches(5), NAVY)
add_text(s, Inches(0.8), Inches(2.1), Inches(5.6), Inches(0.5),
         "Раунд seed", font_size=14, color=ACCENT)
add_text(s, Inches(0.8), Inches(2.5), Inches(5.6), Inches(1),
         "5 000 000 ₽", font_size=48, bold=True, color=WHITE)
add_text(s, Inches(0.8), Inches(3.7), Inches(5.6), Inches(0.4),
         "За 15% доли в проекте", font_size=14, color=ACCENT)

# Распределение
add_rect(s, Inches(0.8), Inches(4.4), Inches(5.4), Inches(0.02), ACCENT)
add_text(s, Inches(0.8), Inches(4.55), Inches(5.6), Inches(0.4),
         "Распределение средств:", font_size=13, bold=True, color=ACCENT)

allocation = [
    ("Разработка и команда", "45%"),
    ("Маркетинг и привлечение", "30%"),
    ("Юридическая экспертиза", "15%"),
    ("Инфраструктура и AI", "10%"),
]

for i, (lbl, pct) in enumerate(allocation):
    ty = Inches(4.95) + Inches(0.45) * i
    add_text(s, Inches(0.8), ty, Inches(4), Inches(0.4),
             lbl, font_size=12, color=WHITE)
    add_text(s, Inches(4.8), ty, Inches(1.6), Inches(0.4),
             pct, font_size=14, bold=True, color=ACCENT,
             align=PP_ALIGN.RIGHT)

# Справа - что получит инвестор
add_round(s, Inches(6.85), Inches(1.9), Inches(6.1), Inches(5), LIGHT_BG)
add_text(s, Inches(7.05), Inches(2.1), Inches(5.7), Inches(0.5),
         "Что получает инвестор", font_size=18, bold=True, color=NAVY)

benefits = [
    ("📈", "Х15 за 3 года",
     "При выходе на 287 млн ₽ выручки оценка проекта — 1,5+ млрд ₽"),
    ("🚀", "Готовый MVP",
     "Продукт уже в продакшене, не нужно ждать разработки"),
    ("🏛", "Регулируемый рынок",
     "LegalTech — устойчивая ниша с барьерами для конкурентов"),
    ("💼", "Опытная команда",
     "Поддержка экспертов МГИМО: бизнес, право, политика"),
    ("📊", "Прозрачный SaaS",
     "Метрики MRR, ARR, churn — всё считается и контролируется"),
]

for i, (icon, title, desc) in enumerate(benefits):
    ty = Inches(2.8) + Inches(0.78) * i
    add_text(s, Inches(7.1), ty, Inches(0.5), Inches(0.5),
             icon, font_size=22, color=ACCENT, align=PP_ALIGN.CENTER)
    add_text(s, Inches(7.7), ty, Inches(5), Inches(0.4),
             title, font_size=13, bold=True, color=NAVY)
    add_text(s, Inches(7.7), ty + Inches(0.4), Inches(5), Inches(0.4),
             desc, font_size=10, color=TEXT_GREY)

add_footer(s, 14, TOTAL)

# ==================== СЛАЙД 15: РИСКИ ====================
s = prs.slides.add_slide(BLANK)
add_bg(s)
header(s, "Риски и их митигация", "Прозрачно о возможных проблемах")

risks = [
    ("Регуляторные изменения",
     "Изменение законодательства об AI или персональных данных",
     "Юридическая команда мониторит изменения, гибкая архитектура для быстрой адаптации",
     "СРЕДНИЙ"),
    ("Конкуренция от крупных игроков",
     "Контур, СПАРК или Яндекс могут запустить аналог",
     "Скорость, нишевая специализация на МСП, более низкая цена",
     "СРЕДНИЙ"),
    ("Качество AI-ответов",
     "ИИ может допускать ошибки в юридических заключениях",
     "Двойная проверка с реальной БД законов, дисклеймер, расширение базы прецедентов",
     "НИЗКИЙ"),
    ("Привлечение клиентов",
     "Высокая стоимость привлечения B2B клиентов",
     "Freemium-модель, контент-маркетинг, реферальная программа",
     "СРЕДНИЙ"),
]

x = Inches(0.6)
y = Inches(2.0)
rw = Inches(12.1)
rh = Inches(1.05)
gap = Inches(0.1)

risk_colors = {"НИЗКИЙ": GREEN, "СРЕДНИЙ": ACCENT, "ВЫСОКИЙ": RED}

for i, (name, desc, mit, level) in enumerate(risks):
    sy = y + (rh + gap) * i
    add_round(s, x, sy, rw, rh, LIGHT_BG)
    # Маркер уровня
    add_rect(s, x, sy, Inches(0.15), rh, risk_colors[level])
    add_text(s, x + Inches(0.4), sy + Inches(0.1), Inches(3.5), Inches(0.4),
             name, font_size=14, bold=True, color=NAVY)
    add_text(s, x + Inches(0.4), sy + Inches(0.5), Inches(3.5), Inches(0.5),
             desc, font_size=10, color=TEXT_GREY)
    add_text(s, x + Inches(4.1), sy + Inches(0.3), Inches(7), Inches(0.5),
             "→ " + mit, font_size=11, color=TEXT_DARK)
    add_round(s, x + Inches(11.0), sy + Inches(0.35), Inches(0.95),
              Inches(0.35), risk_colors[level])
    add_text(s, x + Inches(11.0), sy + Inches(0.37), Inches(0.95),
             Inches(0.3), level, font_size=10, bold=True, color=WHITE,
             align=PP_ALIGN.CENTER, anchor=MSO_ANCHOR.MIDDLE)

add_footer(s, 15, TOTAL)

# ==================== СЛАЙД 16: КОНТАКТЫ / CTA ====================
s = prs.slides.add_slide(BLANK)
add_bg(s, NAVY)
add_oval(s, Inches(-3), Inches(-3), Inches(7), Inches(7), DEEP_BLUE)
add_oval(s, Inches(10), Inches(4), Inches(6), Inches(6), DEEP_BLUE)

add_text(s, Inches(0.6), Inches(1.5), Inches(12.1), Inches(1),
         "Готовы к партнёрству?", font_size=48, bold=True, color=WHITE,
         align=PP_ALIGN.CENTER)
add_text(s, Inches(0.6), Inches(2.5), Inches(12.1), Inches(0.6),
         "Юрист 2.0 — это будущее правовой поддержки бизнеса в России",
         font_size=20, color=ACCENT, align=PP_ALIGN.CENTER)

# Большая кнопка-CTA
add_round(s, Inches(4.5), Inches(3.5), Inches(4.3), Inches(0.9), ACCENT)
add_text(s, Inches(4.5), Inches(3.55), Inches(4.3), Inches(0.8),
         "ЗАПРОСИТЬ ДЕМО", font_size=20, bold=True, color=NAVY,
         align=PP_ALIGN.CENTER, anchor=MSO_ANCHOR.MIDDLE)

# Контакты
add_text(s, Inches(0.6), Inches(5.0), Inches(12.1), Inches(0.5),
         "Хадызов Зураб Джамалаевич",
         font_size=18, bold=True, color=WHITE, align=PP_ALIGN.CENTER)
add_text(s, Inches(0.6), Inches(5.5), Inches(12.1), Inches(0.4),
         "Основатель проекта  ·  МГИМО МИД России",
         font_size=14, color=ACCENT, align=PP_ALIGN.CENTER)

# Каналы связи
contacts = [
    ("✉", "Email", "z.khadyzov@my.mgimo.ru"),
    ("📱", "Telegram", "@khadyzov"),
    ("🌐", "Сайт", "yurist2.vercel.app"),
]
x = Inches(2.5)
y = Inches(6.2)
cw = Inches(2.8)
gap = Inches(0.3)
for i, (icon, lbl, val) in enumerate(contacts):
    sx = x + (cw + gap) * i
    add_text(s, sx, y, cw, Inches(0.4),
             icon + "  " + lbl, font_size=12, color=ACCENT,
             align=PP_ALIGN.CENTER)
    add_text(s, sx, y + Inches(0.4), cw, Inches(0.4),
             val, font_size=12, color=WHITE, align=PP_ALIGN.CENTER, bold=True)

prs.save("/home/user/don/presentations/01_Бизнес_презентация_Юрист2.0.pptx")
print("Бизнес-презентация создана: 16 слайдов")
