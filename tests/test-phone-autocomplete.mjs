import { chromium } from 'playwright';

async function testPhoneAutocomplete() {
	const browser = await chromium.launch({
		headless: false,
		args: ['--ignore-certificate-errors']
	});

	const context = await browser.newContext({
		ignoreHTTPSErrors: true,
		viewport: { width: 1280, height: 720 },
		permissions: []
	});

	const page = await context.newPage();

	try {
		console.log('🚀 Navigating to https://localhost:3001/register...');
		await page.goto('https://localhost:3001/register', {
			waitUntil: 'domcontentloaded',
			timeout: 60000
		});

		await page.reload({ waitUntil: 'networkidle' });
		await page.waitForTimeout(1000);

		await page.waitForSelector('input[name="phone"]', { timeout: 10000 });

		const phoneInput = page.locator('input[name="phone"]');

		console.log('\n========== PHONE AUTOCOMPLETE TEST ==========');

		// Click the phone input to focus
		await phoneInput.click();
		await page.waitForTimeout(300);

		// Test 1: Type "8" to trigger Vietnam (+84) suggestion
		console.log('\n--- Test 1: Type "8" ---');
		await phoneInput.fill('8');
		await page.waitForTimeout(500);

		// Check if suggestions popup appears
		const popupVisible = await page.locator('.phone-suggestions-popup').isVisible();
		console.log('Phone suggestions popup visible:', popupVisible);

		if (popupVisible) {
			// Get all suggestion items
			const suggestions = await page.locator('.phone-suggestion-item').all();
			console.log(`Found ${suggestions.length} suggestions`);

			for (let i = 0; i < suggestions.length; i++) {
				const text = await suggestions[i].textContent();
				console.log(`  Suggestion ${i}: ${text?.trim().substring(0, 100)}`);
			}

			// Check if Vietnam is in suggestions
			const vietnamItem = page.locator('.phone-suggestion-item:has-text("Vietnam")');
			const vietnamExists = await vietnamItem.count() > 0;
			console.log('Vietnam suggestion exists:', vietnamExists);

			// Press Enter to select the first item (Vietnam, already highlighted by default)
			await phoneInput.press('Enter');
			await page.waitForTimeout(300);

			// Check final value
			const finalValue = await phoneInput.inputValue();
			console.log('Final value after selecting Vietnam:', finalValue);
		}

		// Test 2: Type "+8"
		console.log('\n--- Test 2: Type "+8" ---');
		await phoneInput.fill('+8');
		await page.waitForTimeout(500);

		const popupVisible2 = await page.locator('.phone-suggestions-popup').isVisible();
		console.log('Popup visible for +8:', popupVisible2);

		if (popupVisible2) {
			const suggestions2 = await page.locator('.phone-suggestion-item').all();
			console.log(`Found ${suggestions2.length} suggestions for +8`);

			for (let i = 0; i < suggestions2.length; i++) {
				const text = await suggestions2[i].textContent();
				console.log(`  Suggestion ${i}: ${text?.trim().substring(0, 100)}`);
			}

			// Press Enter to select the first item
			await phoneInput.press('Enter');
			await page.waitForTimeout(300);
			const finalValue2 = await phoneInput.inputValue();
			console.log('Final value after selecting +84:', finalValue2);
		}

		// Test 3: Type "84"
		console.log('\n--- Test 3: Type "84" ---');
		await phoneInput.fill('84');
		await page.waitForTimeout(500);

		const popupVisible3 = await page.locator('.phone-suggestions-popup').isVisible();
		console.log('Popup visible for 84:', popupVisible3);

		if (popupVisible3) {
			const suggestions3 = await page.locator('.phone-suggestion-item').all();
			console.log(`Found ${suggestions3.length} suggestions for 84`);

			for (let i = 0; i < suggestions3.length; i++) {
				const text = await suggestions3[i].textContent();
				console.log(`  Suggestion ${i}: ${text?.trim().substring(0, 100)}`);
			}

			// Press Enter to select the first item
			await phoneInput.press('Enter');
			await page.waitForTimeout(300);
			const finalValue3 = await phoneInput.inputValue();
			console.log('Final value after selecting +84:', finalValue3);
		}

		// Test 4: Type "1" for US
		console.log('\n--- Test 4: Type "1" (US) ---');
		await phoneInput.fill('1');
		await page.waitForTimeout(500);

		const popupVisible4 = await page.locator('.phone-suggestions-popup').isVisible();
		console.log('Popup visible for 1:', popupVisible4);

		if (popupVisible4) {
			const suggestions4 = await page.locator('.phone-suggestion-item').all();
			console.log(`Found ${suggestions4.length} suggestions for 1`);

			for (let i = 0; i < suggestions4.length; i++) {
				const text = await suggestions4[i].textContent();
				console.log(`  Suggestion ${i}: ${text?.trim().substring(0, 100)}`);
			}

			// Press Enter to select the first item
			await phoneInput.press('Enter');
			await page.waitForTimeout(300);
			const finalValue4 = await phoneInput.inputValue();
			console.log('Final value after selecting +1:', finalValue4);
		}

		// Check input type
		const inputType = await phoneInput.getAttribute('type');
		console.log('\nInput type attribute:', inputType);

		// Check inputmode
		const inputMode = await phoneInput.getAttribute('inputmode');
		console.log('Inputmode attribute:', inputMode);

		// Check autocomplete
		const autocomplete = await phoneInput.getAttribute('autocomplete');
		console.log('Autocomplete attribute:', autocomplete);

		// Check if phone suggestion is working by looking at the component
		const componentState = await page.evaluate(() => {
			const inputs = document.querySelectorAll('input[name="phone"]');
			for (const input of inputs) {
				let el = input.parentElement;
				while (el && !el.classList.contains('input-root')) {
					el = el.parentElement;
				}
				if (el) {
					// Check if there's a phone-suggestions-popup
					const popup = el.querySelector('.phone-suggestions-popup');
					return {
						hasPopup: !!popup,
						popupVisible: popup ? window.getComputedStyle(popup).display !== 'none' : false,
						popupHTML: popup ? popup.innerHTML.substring(0, 500) : null
					};
				}
			}
			return null;
		});
		console.log('\nComponent state:', JSON.stringify(componentState, null, 2));

	} catch (error) {
		console.error('Error:', error);
	} finally {
		await browser.close();
	}
}

testPhoneAutocomplete().catch(console.error);