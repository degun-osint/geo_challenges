CTFd.plugin.run((_CTFd) => {
    const _t = {
        en: {
            no_pin:           "Please place a pin on the map before submitting.",
            net_error:        "Network error — please try again.",
            submit_btn:       "Submit Location",
            search_placeholder: "Search a location…",
            coord_placeholder:  "Enter your coordinates: 48.858398, 2.294417",
            coord_label:      "Or enter coordinates (lat, lon):",
            pin_hint_desktop: "Click to place · drag to refine · arrows for precision",
            pin_hint_mobile:  "Tap to place · drag to move",
            tol_off_title:    "Show acceptance zone — your pin must be INSIDE this circle to be validated",
            tol_on_title:     "Acceptance zone visible — your pin must be INSIDE this circle (not on the edge, inside!)",
            fullscreen:       "Fullscreen",
            fullscreen_exit:  "Exit fullscreen",
            recenter_title:   "Go to my pin",
            banner_title:     "Accepted answer zone",
            banner_line1:     "This challenge allows some imprecision.",
            banner_line2:     "Place your marker where you think the location is.",
            banner_line3:     "The blue circle shows the acceptance radius around the exact target.",
            banner_line4:     "If your marker is inside the circle, your answer will be validated.",
        },
        fr: {
            no_pin:           "Veuillez d'abord placer un marqueur sur la carte.",
            net_error:        "Erreur réseau — veuillez réessayer.",
            submit_btn:       "Soumettre la position",
            search_placeholder: "Rechercher une adresse…",
            coord_placeholder:  "Rentrez vos coordonnées : 48.858398, 2.294417",
            coord_label:      "Ou entrez des coordonnées (lat, lon) :",
            pin_hint_desktop: "Cliquer pour placer · glisser pour affiner · flèches pour la précision",
            pin_hint_mobile:  "Appuyer pour placer · glisser pour déplacer",
            tol_off_title:    "Afficher la zone de tolérance",
            tol_on_title:     "Masquer la zone de tolérance",
            fullscreen:       "Plein écran",
            fullscreen_exit:  "Quitter le plein écran",
            recenter_title:   "Revenir à mon marqueur",
            banner_title:     "Zone de réponse acceptée",
            banner_line1:     "Ce challenge tolère une certaine imprécision.",
            banner_line2:     "Placez votre marqueur à l'endroit que vous pensez être la cible.",
            banner_line3:     "Le cercle bleu représente le rayon d'acceptation autour de la cible exacte.",
            banner_line4:     "Si votre marqueur est dans le cercle, votre réponse sera validée.",
        },
        es: {
            no_pin:           "Por favor, coloca un marcador en el mapa antes de enviar.",
            net_error:        "Error de red — inténtalo de nuevo.",
            submit_btn:       "Enviar ubicación",
            search_placeholder: "Buscar una ubicación…",
            coord_placeholder:  "Introduce tus coordenadas: 48.858398, 2.294417",
            coord_label:      "O introduce coordenadas (lat, lon):",
            pin_hint_desktop: "Clic para colocar · arrastrar para afinar · flechas para precisión",
            pin_hint_mobile:  "Toca para colocar · arrastra para mover",
            tol_off_title:    "Mostrar zona de aceptación — tu marcador debe estar DENTRO de este círculo para ser validado",
            tol_on_title:     "Zona de aceptación visible — tu marcador debe estar DENTRO de este círculo (¡no en el borde, dentro!)",
            fullscreen:       "Pantalla completa",
            fullscreen_exit:  "Salir de pantalla completa",
            recenter_title:   "Ir a mi marcador",
            banner_title:     "Zona de respuesta aceptada",
            banner_line1:     "Este reto permite cierta imprecisión.",
            banner_line2:     "Coloca tu marcador donde creas que está la ubicación.",
            banner_line3:     "El círculo azul muestra el radio de aceptación alrededor del objetivo exacto.",
            banner_line4:     "Si tu marcador está dentro del círculo, tu respuesta será validada.",
        },
        de: {
            no_pin:           "Bitte setze zuerst einen Marker auf der Karte.",
            net_error:        "Netzwerkfehler — bitte erneut versuchen.",
            submit_btn:       "Standort einreichen",
            search_placeholder: "Ort suchen…",
            coord_placeholder:  "Koordinaten eingeben: 48.858398, 2.294417",
            coord_label:      "Oder Koordinaten eingeben (Breite, Länge):",
            pin_hint_desktop: "Klicken zum Platzieren · Ziehen zum Verfeinern · Pfeiltasten für Präzision",
            pin_hint_mobile:  "Tippen zum Platzieren · Ziehen zum Bewegen",
            tol_off_title:    "Akzeptanzzone anzeigen — dein Marker muss INNERHALB dieses Kreises liegen",
            tol_on_title:     "Akzeptanzzone sichtbar — dein Marker muss INNERHALB dieses Kreises liegen (nicht am Rand, drinnen!)",
            fullscreen:       "Vollbild",
            fullscreen_exit:  "Vollbild beenden",
            recenter_title:   "Zum Marker springen",
            banner_title:     "Akzeptierte Antwortzone",
            banner_line1:     "Diese Aufgabe erlaubt eine gewisse Ungenauigkeit.",
            banner_line2:     "Platziere deinen Marker dort, wo du den Ort vermutest.",
            banner_line3:     "Der blaue Kreis zeigt den Akzeptanzradius um den genauen Zielort.",
            banner_line4:     "Wenn dein Marker innerhalb des Kreises liegt, wird deine Antwort gewertet.",
        },
        ja: {
            no_pin:           "送信する前に地図上にマーカーを置いてください。",
            net_error:        "ネットワークエラー — もう一度お試しください。",
            submit_btn:       "場所を送信",
            search_placeholder: "場所を検索…",
            coord_placeholder:  "座標を入力：48.858398, 2.294417",
            coord_label:      "または座標を入力（緯度, 経度）：",
            pin_hint_desktop: "クリックして配置・ドラッグで微調整・矢印キーで精密操作",
            pin_hint_mobile:  "タップして配置・ドラッグで移動",
            tol_off_title:    "許容ゾーンを表示 — マーカーはこの円のINSIDEになければなりません",
            tol_on_title:     "許容ゾーン表示中 — マーカーはこの円の内側に置いてください（端ではなく、中に！）",
            fullscreen:       "全画面",
            fullscreen_exit:  "全画面を終了",
            recenter_title:   "マーカーに戻る",
            banner_title:     "許容回答ゾーン",
            banner_line1:     "このチャレンジはある程度の誤差を許容します。",
            banner_line2:     "場所と思われる位置にマーカーを置いてください。",
            banner_line3:     "青い円は正解地点の周囲の許容半径を示しています。",
            banner_line4:     "マーカーが円の内側にあれば、回答は有効とみなされます。",
        },
    };

    function _lang() {
        const fromCookie = document.cookie
            .split("; ")
            .find((r) => r.startsWith("language="))
            ?.split("=")[1];
        return _t[fromCookie] ? fromCookie : "en";
    }

    window.GeoLocI18n = {
        t(key, defaultVal) {
            const lang = _lang();
            return _t[lang]?.[key] ?? _t.en[key] ?? defaultVal ?? key;
        },
    };

    // Translate all [data-i18n] text nodes and rebuild the acceptance zone banner.
    function _applyI18n(root) {
        root.querySelectorAll("[data-i18n]").forEach((el) => {
            const key = el.getAttribute("data-i18n");
            const val = window.GeoLocI18n.t(key);
            // Preserve leading whitespace (e.g. " Submit Location") for inline elements.
            if (val && val !== key) {
                const leading = el.textContent.match(/^\s*/)[0];
                el.textContent = leading + val;
            }
        });

        // Rebuild the acceptance-zone banner with translated content.
        const banner = root.querySelector("#geoloc-tol-banner");
        if (banner) {
            banner.innerHTML =
                "🗺️ <strong>" + window.GeoLocI18n.t("banner_title") + "</strong> — " +
                window.GeoLocI18n.t("banner_line1") + "<br>" +
                window.GeoLocI18n.t("banner_line2") + "<br>" +
                window.GeoLocI18n.t("banner_line3") + "<br>" +
                "<em>" + window.GeoLocI18n.t("banner_line4") + "</em>";
        }
    }

    // Apply translations each time a modal containing a GeoLoc map is shown.
    document.addEventListener("shown.bs.modal", (e) => {
        if (e.target.querySelector("#geoloc-player-map")) {
            _applyI18n(e.target);
        }
    });
});
