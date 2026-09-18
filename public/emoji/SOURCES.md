# Эмодзи проекта

**Apple Color Emoji. © Apple Inc. Все права на изображения принадлежат Apple.**

Лицензия MIT этого проекта распространяется на код и **не распространяется на
эти картинки**. Apple лицензирует свой шрифт эмодзи для использования на
устройствах Apple; применение на других системах остаётся на усмотрение и под
ответственность того, кто их применяет.

Если вам это не подходит, наберите открытый набор одной командой — сцены
работают с ним без правок:

```
python scripts/get-emoji.py --force    # Fluent Emoji, Microsoft, лицензия MIT
```

## Откуда взято

Файлы вынуты скриптом `scripts/emoji-from-font.py` из публичной пересборки
шрифта <https://github.com/samuelngs/apple-emoji-ttf>, релиз
`macos-26-20260722-484daf4e`, файл `AppleColorEmoji-Linux.ttf`. Лицензия MIT той
пересборки покрывает её скрипты сборки, а не рисунки — об этом сказано в её
собственном дисклеймере.

Максимальный размер картинки в этой сборке — 96×96. Этого хватает плашкам и
строчным вставкам; для объекта во весь кадр нужен другой источник.

## Состав

22 символа: alarm_clock, bell, brain, calendar, chart_increasing,
check_mark_button, clapper_board, cross_mark, eyes, fire, gear, hourglass_done,
light_bulb, magnifying_glass_tilted_left, microphone, money_bag, party_popper,
red_heart, rocket, speech_balloon, thumbs_up, warning.

Добавить символ: вписать его в `CHARACTERS` в `scripts/emoji-from-font.py` и
прогнать скрипт по тому же файлу шрифта.
