
import ControllerManager from '../controllers/controllerManager.mjs';

export default class SettingsUI {
    static initialize() {
        // Create deadzone slider
        const deadzoneContainer = document.createElement('div');
        deadzoneContainer.innerHTML = `
            <label for="deadzoneSlider">Gamepad Deadzone Threshold: <span id="deadzoneValue">0.1</span></label>
            <input type="range" id="deadzoneSlider" min="0" max="0.5" step="0.01" value="0.1">
        `;
        document.body.appendChild(deadzoneContainer);

        const deadzoneSlider = document.getElementById('deadzoneSlider');
        const deadzoneValue = document.getElementById('deadzoneValue');

        deadzoneSlider.addEventListener('input', (event) => {
            const value = parseFloat(event.target.value);
            deadzoneValue.textContent = value.toFixed(2);
            ControllerManager.setDeadzoneThreshold(value);
        });
    }
}
