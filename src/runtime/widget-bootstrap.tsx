import Widget from "virtual:widget-component"
import React, { StrictMode } from "react"
import { createRoot } from "react-dom/client"

const root = document.getElementById("virtual:widget-name-root")
if (root) {
	createRoot(root).render(
		<StrictMode>
			<Widget />
		</StrictMode>,
	)
}
