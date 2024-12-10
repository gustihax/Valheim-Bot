const {
	EmbedBuilder,
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
} = require('discord.js')
const axios = require('axios')
const cheerio = require('cheerio')
const fs = require('fs').promises
const path = require('path')

const SCHEDULE_FILE = path.join(__dirname, 'schedule.json')

async function loadSchedule() {
	try {
		const data = await fs.readFile(SCHEDULE_FILE, 'utf8')
		return JSON.parse(data)
	} catch (error) {
		return []
	}
}

async function saveSchedule(schedule) {
	await fs.writeFile(SCHEDULE_FILE, JSON.stringify(schedule, null, 2))
}

function isValidDate(dateStr) {
	try {
		// Розбиваємо дату на компоненти
		const [day, month, year] = dateStr.split('.').map(Number)

		// Створюємо об'єкт дати
		const date = new Date(year, month - 1, day)
		const today = new Date()
		today.setHours(0, 0, 0, 0)

		// Перевіряємо, чи дата валідна і не в минулому
		const isValid =
			date instanceof Date &&
			!isNaN(date) &&
			date.getDate() === day &&
			date.getMonth() === month - 1 &&
			date.getFullYear() === year &&
			date >= today

		if (!isValid) {
			console.log('Invalid date:', {
				dateStr,
				parsed: { day, month, year },
				date,
				today,
				checks: {
					isDate: date instanceof Date,
					isNotNaN: !isNaN(date),
					dayMatch: date.getDate() === day,
					monthMatch: date.getMonth() === month - 1,
					yearMatch: date.getFullYear() === year,
					notInPast: date >= today,
				},
			})
		}

		return isValid
	} catch (error) {
		console.error('Date validation error:', error)
		return false
	}
}

function isValidTime(timeStr) {
	const singleTimeRegex = /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/
	const rangeTimeRegex =
		/^([0-1][0-9]|2[0-3]):[0-5][0-9]-([0-1][0-9]|2[0-3]):[0-5][0-9]$/

	if (singleTimeRegex.test(timeStr)) {
		return true
	}

	if (rangeTimeRegex.test(timeStr)) {
		const [startTime, endTime] = timeStr.split('-')
		const [startHour, startMinute] = startTime.split(':').map(Number)
		const [endHour, endMinute] = endTime.split(':').map(Number)

		const startMinutes = startHour * 60 + startMinute
		const endMinutes = endHour * 60 + endMinute

		return endMinutes > startMinutes
	}

	return false
}

function formatTimeDisplay(time) {
	if (time.includes('-')) {
		const [start, end] = time.split('-')
		return `${start} — ${end}`
	}
	return time
}

async function handleAddSchedule(interaction, date, time, title) {
	await interaction.deferReply()

	const schedule = await loadSchedule()

	const isDuplicate = schedule.some(
		event =>
			event.date === date &&
			event.time === time &&
			event.title.toLowerCase() === title.toLowerCase()
	)

	if (isDuplicate) {
		const errorEmbed = new EmbedBuilder()
			.setColor('#ED4245')
			.setAuthor({
				name: 'Помилка додавання події',
				iconURL:
					'https://ih1.redbubble.net/image.3117871954.9351/st,small,507x507-pad,600x600,f8f8f8.jpg',
			})
			.setDescription(
				'❌ Така подія вже існує в розкладі!\n\n' +
					`**${title}**\n` +
					`📅 ${date}\n` +
					`⏰ ${time}`
			)
			.setFooter({
				text: 'Valheim Project • Система планування',
				iconURL:
					'https://gcdn.thunderstore.io/live/repository/icons/Harleyy-HarleysModpackEnhanced-1.0.7.png.256x256_q95.png',
			})
		return await interaction.editReply({ embeds: [errorEmbed] })
	}

	const newEvent = {
		id: schedule.length + 1,
		date,
		time,
		title,
		createdBy: interaction.user.id,
		createdAt: new Date().toISOString(),
	}

	schedule.push(newEvent)
	await saveSchedule(schedule)

	const [day, month, year] = date.split('.')
	const timeDisplay = formatTimeDisplay(time)

	const months = {
		'01': 'Січня',
		'02': 'Лютого',
		'03': 'Березня',
		'04': 'Квітня',
		'05': 'Травня',
		'06': 'Червня',
		'07': 'Липня',
		'08': 'Серпня',
		'09': 'Вересня',
		10: 'Жовтня',
		11: 'Листопада',
		12: 'Грудня',
	}

	const embed = new EmbedBuilder()
		.setColor('#5865F2')
		.setAuthor({
			name: 'Нова подія додана до розкладу',
			iconURL:
				'https://ih1.redbubble.net/image.3117871954.9351/st,small,507x507-pad,600x600,f8f8f8.jpg',
		})
		.setDescription(
			`💫 **Опис події:** ${title}\n\n` +
				`📅 ${day} ${months[month]} ${year}\n` +
				`⏰ ${timeDisplay}\n` +
				`👤 ${interaction.user.username}\n` +
				`🔍 ID: #${newEvent.id}`
		)
		.setFooter({
			text: `Valheim Project • Система планування • ${new Date().toLocaleString(
				'uk-UA',
				{
					day: '2-digit',
					month: '2-digit',
					year: 'numeric',
					hour: '2-digit',
					minute: '2-digit',
				}
			)}`,
			iconURL:
				'https://gcdn.thunderstore.io/live/repository/icons/Harleyy-HarleysModpackEnhanced-1.0.7.png.256x256_q95.png',
		})

	await interaction.editReply({ embeds: [embed] })
}

const emojis = {
	spacer: '•',
}

async function handleShowSchedule(interaction) {
	await interaction.deferReply()

	const schedule = await loadSchedule()
	if (schedule.length === 0) {
		const emptyEmbed = new EmbedBuilder()
			.setColor('#5865F2')
			.setAuthor({
				name: 'Розклад подій порожній',
				iconURL:
					'https://ih1.redbubble.net/image.3117871954.9351/st,small,507x507-pad,600x600,f8f8f8.jpg',
			})
			.setDescription('*Наразі немає запланованих подій*')
			.setFooter({
				text: 'Valheim Project • Система планування',
				iconURL:
					'https://gcdn.thunderstore.io/live/repository/icons/Harleyy-HarleysModpackEnhanced-1.0.7.png.256x256_q95.png',
			})
		return await interaction.editReply({ embeds: [emptyEmbed] })
	}

	schedule.sort((a, b) => {
		const dateA = new Date(
			a.date.split('.').reverse().join('-') + 'T' + a.time.split('-')[0]
		)
		const dateB = new Date(
			b.date.split('.').reverse().join('-') + 'T' + b.time.split('-')[0]
		)
		return dateA - dateB
	})

	const embed = new EmbedBuilder()
		.setColor('#5865F2')
		.setDescription(
			`# Розклад подій\n\n` +
				schedule
					.map(event => {
						const [startTime, endTime] = event.time.split('-')
						return (
							`## ${event.title}\n` +
							`📅 Дата • 👥 Час • 👤 Організатор\n` +
							`${event.date} • ${startTime}—${endTime} • <@${event.createdBy}>\n` +
							`ID: ${event.id}`
						)
					})
					.join('\n\n━━━━━━━━━━━━━━━━━━━━━\n\n')
		)
		.setThumbnail(
			'https://ih1.redbubble.net/image.3117871954.9351/st,small,507x507-pad,600x600,f8f8f8.jpg'
		)
		.setFooter({
			text: 'Valheim Project • Система планування',
			iconURL:
				'https://gcdn.thunderstore.io/live/repository/icons/Harleyy-HarleysModpackEnhanced-1.0.7.png.256x256_q95.png',
		})

	await interaction.editReply({ embeds: [embed] })
}

async function handleDeleteSchedule(interaction, id) {
	await interaction.deferReply()

	const schedule = await loadSchedule()
	const eventIndex = schedule.findIndex(event => event.id === id)

	if (eventIndex === -1) {
		const errorEmbed = new EmbedBuilder()
			.setColor('#ED4245')
			.setAuthor({
				name: 'Помилка видалення події',
				iconURL:
					'https://ih1.redbubble.net/image.3117871954.9351/st,small,507x507-pad,600x600,f8f8f8.jpg',
			})
			.setDescription('❌ Подію не знайдено!')
			.setFooter({
				text: 'Valheim Project • Система планування',
				iconURL:
					'https://gcdn.thunderstore.io/live/repository/icons/Harleyy-HarleysModpackEnhanced-1.0.7.png.256x256_q95.png',
			})
		return await interaction.editReply({ embeds: [errorEmbed] })
	}

	const event = schedule[eventIndex]
	if (event.createdBy !== interaction.user.id) {
		const errorEmbed = new EmbedBuilder()
			.setColor('#FF7B7B')
			.setDescription('# ❌ Ви можете видаляти тільки власні події!')
			.setThumbnail(
				'https://cdn.discordapp.com/avatars/1215679242817966171/589c7a34135c8ce0d678ae1e828091c8.webp'
			)
		return await interaction.editReply({ embeds: [errorEmbed] })
	}

	schedule.splice(eventIndex, 1)
	await saveSchedule(schedule)

	const embed = new EmbedBuilder()
		.setColor('#57F287')
		.setDescription(
			`# ✅ Подію видалено\n\n` +
				`## ${event.title}\n\n` +
				`📅 Дата • ⏰ Час\n` +
				`${event.date} • ${event.time}\n\n` +
				`ID: ${event.id}`
		)
		.setThumbnail(
			'https://cdn.discordapp.com/avatars/1215679242817966171/589c7a34135c8ce0d678ae1e828091c8.webp'
		)

	await interaction.editReply({ embeds: [embed] })
}

async function handleSendSchedule(interaction, user, id) {
	await interaction.deferReply()

	const schedule = await loadSchedule()
	const event = schedule.find(event => event.id === id)

	if (!event) {
		return await interaction.editReply('❌ Подію не знайдено!')
	}

	const embed = new EmbedBuilder()
		.setColor('#0099ff')
		.setTitle('📅 Запрошення на подію')
		.setDescription(
			`**${event.title}**\n` +
				`📅 ${event.date}\n` +
				`⏰ ${event.time}\n` +
				`👤 Організатор: <@${event.createdBy}>`
		)
		.setFooter({ text: `ID: ${event.id}` })

	try {
		await user.send({ embeds: [embed] })
		await interaction.editReply(
			`✅ Запрошення надіслано користувачу ${user.tag}!`
		)
	} catch (error) {
		await interaction.editReply(
			'❌ Не вдалося надіслати повідомлення користувачу. Можливо, у нього закриті приватні повідомлення.'
		)
	}
}

async function handleSearch(interaction, query, page = 1) {
	try {
		const isButton = interaction.isButton()

		if (!isButton) {
			await interaction.deferReply()
		}

		const searchUrl = `https://www.olx.ua/d/uk/list/q-${encodeURIComponent(
			query
		)}/?page=${page}`
		const response = await axios.get(searchUrl)
		const $ = cheerio.load(response.data)

		const results = []
		$('div[data-cy="l-card"]').each((i, el) => {
			if (i >= 5) return false

			const title = $(el).find('[data-testid="ad-title"]').text().trim()
			const price = $(el).find('[data-testid="ad-price"]').text().trim()
			const link = $(el).find('a').attr('href')
			const fullLink = link.startsWith('http')
				? link
				: `https://www.olx.ua${link}`
			const imgUrl = $(el).find('img').attr('src')

			results.push({ title, price, link: fullLink, imgUrl })
		})

		if (results.length === 0) {
			const noResultsMessage = {
				content: '❌ За вашим запитом нічого не знайдено.',
			}
			if (isButton) {
				await interaction.message.edit(noResultsMessage)
			} else {
				await interaction.editReply(noResultsMessage)
			}
			return
		}

		const embed = new EmbedBuilder()
			.setColor('#2b2d31')
			.setTitle(`🔍 Результати пошуку: ${query}`)

		const description = results
			.map((item, i) => {
				const price = item.price.includes('грн')
					? item.price
					: `${item.price} грн.`
				return `${i + 1}.\n💰 ${price}\n🔗 [Посилання](${item.link})`
			})
			.join('\n\n')

		embed
			.setDescription(description)
			.setThumbnail(results[0]?.imgUrl || null)
			.setFooter({
				text: `Сторінка ${page} • ${new Date().toLocaleTimeString('uk-UA', {
					hour: '2-digit',
					minute: '2-digit',
				})}`,
			})

		const row = new ActionRowBuilder().addComponents(
			new ButtonBuilder()
				.setCustomId(`prev:${query}:${page}`)
				.setEmoji('⬅️')
				.setStyle(ButtonStyle.Secondary)
				.setDisabled(page <= 1),
			new ButtonBuilder()
				.setCustomId(`next:${query}:${page}`)
				.setEmoji('➡️')
				.setStyle(ButtonStyle.Secondary)
				.setDisabled(results.length < 5)
		)

		const messagePayload = { embeds: [embed], components: [row] }

		let message
		if (isButton) {
			message = await interaction.message.edit(messagePayload)
			try {
				await interaction.deferUpdate()
			} catch (error) {}
		} else {
			message = await interaction.editReply(messagePayload)
		}

		const collector = message.createMessageComponentCollector({
			filter: i => i.user.id === interaction.user.id,
			time: 300000,
		})

		collector.on('collect', async buttonInt => {
			try {
				const [action, q, p] = buttonInt.customId.split(':')
				const newPage = action === 'next' ? Number(p) + 1 : Number(p) - 1
				await handleSearch(buttonInt, q, newPage)
			} catch (error) {
				console.error('Button interaction error:', error)
			}
		})
	} catch (error) {
		console.error('Search error:', error)
		const errorMessage = '❌ Помилка при пошуку. Спробуйте пізніше.'

		try {
			if (isButton) {
				await interaction.message.edit({
					content: errorMessage,
					components: [],
				})
			} else if (!interaction.replied) {
				await interaction.reply({ content: errorMessage, ephemeral: true })
			} else {
				await interaction.editReply({ content: errorMessage })
			}
		} catch (e) {
			console.error('Error handling error:', e)
		}
	}
}

async function handleHelp(interaction) {
	const embed = new EmbedBuilder()
		.setColor('#0099ff')
		.setTitle('📋 Команди бота')
		.setDescription(
			'🔍 **/search** `<запит>` - Пошук товарів на OLX\n' +
				'❓ **/help** - Показати це повідомлення'
		)

	await interaction.reply({ embeds: [embed] })
}

async function handleMultipleSchedules(interaction, eventsInput) {
	await interaction.deferReply()
	const schedule = await loadSchedule()
	const results = []
	const errors = []

	const eventsList = eventsInput
		.split(';')
		.map(e => e.trim())
		.filter(e => e.length > 0)

	for (const eventStr of eventsList) {
		try {
			const [date, time, ...titleParts] = eventStr.split(' ').filter(Boolean)
			const title = titleParts.join(' ')

			if (!date || !time || !title) {
				errors.push(
					`Неправильний формат події. Використовуйте: ДД.ММ.РРРР ГГ:ХХ[-ГГ:ХХ] Назва\nОтримано: ${eventStr}`
				)
				continue
			}

			if (!date.match(/^\d{2}\.\d{2}\.\d{4}$/) || !isValidDate(date)) {
				errors.push(`Недійсна дата: ${date}`)
				continue
			}

			if (!time.match(/^\d{2}:\d{2}(-\d{2}:\d{2})?$/) || !isValidTime(time)) {
				errors.push(`Недійсний формат часу: ${time}`)
				continue
			}

			const isDuplicate = schedule.some(
				event =>
					event.date === date &&
					event.time === time &&
					event.title.toLowerCase() === title.toLowerCase()
			)

			if (isDuplicate) {
				errors.push(`Подія вже існує: ${title} (${date} ${time})`)
				continue
			}

			const newEvent = {
				id: schedule.length + 1,
				date,
				time,
				title,
				createdBy: interaction.user.id,
				createdAt: new Date().toISOString(),
			}

			schedule.push(newEvent)
			results.push(newEvent)
		} catch (error) {
			console.error('Event processing error:', error)
			errors.push(`Помилка при обробці події: ${eventStr}`)
		}
	}

	if (results.length > 0) {
		await saveSchedule(schedule)
	}

	const [day, month, year] = results[0]?.date.split('.') || []
	const months = {
		'01': 'Січня',
		'02': 'Лютого',
		'03': 'Березня',
		'04': 'Квітня',
		'05': 'Травня',
		'06': 'Червня',
		'07': 'Липня',
		'08': 'Серпня',
		'09': 'Вересня',
		10: 'Жовтня',
		11: 'Листопада',
		12: 'Грудня',
	}

	const embed = new EmbedBuilder()
		.setColor(results.length > 0 ? '#5865F2' : '#ED4245')
		.setAuthor({
			name: 'Додавання подій до розкладу',
			iconURL:
				'https://ih1.redbubble.net/image.3117871954.9351/st,small,507x507-pad,600x600,f8f8f8.jpg',
		})

	if (results.length > 0) {
		let description = '✅ **Успішно додані події:**\n\n'

		for (const event of results) {
			const [eventDay, eventMonth, eventYear] = event.date.split('.')
			const timeDisplay = formatTimeDisplay(event.time)

			description +=
				`### 📝 Опис події: ${event.title}\n` +
				`📅 ${eventDay} ${months[eventMonth]} ${eventYear}\n` +
				`⏰ ${timeDisplay}\n` +
				`👤 Організатор: <@${event.createdBy}>\n` +
				`🔍 ID: #${event.id}\n\n` +
				`━━━━━━━━━━━━━━━━━━━━━\n\n`
		}

		embed.setDescription(description)
	} else {
		embed.setDescription(`# ❌ Помилки:\n\n${errors.join('\n')}`)
	}

	embed.setFooter({
		text: `Valheim Project • Система планування • ${new Date().toLocaleString(
			'uk-UA',
			{
				day: '2-digit',
				month: '2-digit',
				year: 'numeric',
				hour: '2-digit',
				minute: '2-digit',
			}
		)}`,
		iconURL:
			'https://gcdn.thunderstore.io/live/repository/icons/Harleyy-HarleysModpackEnhanced-1.0.7.png.256x256_q95.png',
	})

	await interaction.editReply({ embeds: [embed] })
}

module.exports = {
	handleSearch,
	handleHelp,
	handleAddSchedule,
	handleShowSchedule,
	handleDeleteSchedule,
	handleSendSchedule,
	handleMultipleSchedules,
}
