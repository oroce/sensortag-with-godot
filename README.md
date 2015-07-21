### Sensortag fun with influxdb, godot

Reading data from sensortag, sending to godot server and writing to influxdb.

### Running

1. Start influxdb
2. npm run server
3. npm run client
4. hit the button on sensortag
5. start grafana
6. open stats from assets/sensortag.json
7. watch and smile:)


### Provision

`ansible-playbook -i hosts provision/site.yml`


### Vagrant

1. Install vagrant-env:
`vagrant plugin install vagrant-env`

2. Get Oracle Virtualbox Extension Pack: https://www.virtualbox.org/wiki/Downloads

3. Get the `VendorId` and `ProductId` of desired BLE device
`VBoxManage list usbhost`

4. Add `VendorId` and `ProductId` to the `.env` file
   ~~~
   BLE_VENDORID=0x0a12
   BLE_PRODUCTID=0x0001
   ~~~

5. `vagrant up`

6. `vagrant suspend`

7. Remove the USB dongle

8. `vagrant up`

9. Magic, BT device is available in the guest OS

Steps 5-9 are stolen from [http://stackoverflow.com/questions/24318375/how-to-eject-a-usb-hid-device-from-mac-osx-to-use-in-ubuntu-vm](http://stackoverflow.com/questions/24318375/how-to-eject-a-usb-hid-device-from-mac-osx-to-use-in-ubuntu-vm).
