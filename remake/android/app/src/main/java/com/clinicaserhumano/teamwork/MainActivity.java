package com.clinicaserhumano.teamwork;

import android.os.Bundle;
import android.webkit.WebSettings;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        // Permite que el sonido de ambiente empiece sin esperar a un toque
        WebSettings ajustes = getBridge().getWebView().getSettings();
        ajustes.setMediaPlaybackRequiresUserGesture(false);
    }

    // Pantalla completa (sin barras del sistema); se muestran deslizando desde el borde
    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) {
            WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
            WindowInsetsControllerCompat controlador = WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView());
            controlador.hide(WindowInsetsCompat.Type.systemBars());
            controlador.setSystemBarsBehavior(WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
        }
    }
}
