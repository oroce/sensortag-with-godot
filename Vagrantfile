# -*- mode: ruby -*-
# vi: set ft=ruby :

Vagrant.configure(2) do |config|
  # I couldnt make it work trusty64 with my Cambridge Silicon Radio, Ltd Bluetooth Dongle (HCI mode)
  config.vm.box = "debian/jessie64"
  config.env.enable
  if ENV.has_key?('BLE_VENDORID') and ENV.has_key?('BLE_PRODUCTID')
    config.vm.provider "virtualbox" do |vb|
      vb.customize ["modifyvm", :id, "--usb", "on"]
      vb.customize ["modifyvm", :id, "--usbehci", "on"]
      vb.customize ["usbfilter", "add", "0", 
          "--target", :id, 
          "--name", ENV['BLE_NAME'] || 'BLE Device',
          "--vendorid", ENV['BLE_VENDORID'],
          "--productid", ENV['BLE_PRODUCTID']]
    end
  end
  config.vm.provision "shell", inline: <<-SHELL
     sudo apt-get update
     sudo apt-get upgrade
     sudo apt-get install -y bluetooth bluez libbluetooth-dev build-essential git-core
     curl -sL https://deb.nodesource.com/setup_0.12 | sudo -E bash -
     sudo apt-get install -y nodejs
     cd /vagrant
     npm install
  SHELL
end

